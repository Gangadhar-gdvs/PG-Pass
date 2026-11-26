import 'server-only';
import { adminAuth, adminDb } from '../firebase-admin';
import { AppError } from '../api/withErrorHandler';
import { Resident, Tenant } from '@/types';
import { Timestamp } from 'firebase-admin/firestore';

function cleanPhone(raw: string): string {
  return (raw || '').replace(/\D/g, '').slice(-10);
}

export class ResidentsService {
  /**
   * Promote an authenticated Firebase user into a resident account: sets the
   * `role: 'resident'` custom claim and stores the residents/{uid} profile.
   * The resident's phone is the key that links them to tenant records that PG
   * owners created for that number.
   */
  async register(uid: string, input: { name: string; phone: string; email?: string }): Promise<Resident> {
    const phone = cleanPhone(input.phone);
    if (phone.length !== 10) throw new AppError(400, 'A valid 10-digit phone number is required');
    if (!input.name || input.name.trim().length < 2) throw new AppError(400, 'Name is required');

    // Don't let an existing owner/staff/admin convert into a resident.
    const user = await adminAuth.getUser(uid).catch(() => null);
    const existingRole = (user?.customClaims as { role?: string } | undefined)?.role;
    if (user?.customClaims?.admin || existingRole === 'owner' || existingRole === 'staff') {
      throw new AppError(403, 'This account is already registered in another role');
    }

    await adminAuth.setCustomUserClaims(uid, { role: 'resident' });

    const now = Timestamp.now();
    const resident: Resident = {
      id: uid,
      name: input.name.trim(),
      phone,
      email: input.email?.trim().toLowerCase() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    await adminDb.collection('residents').doc(uid).set(resident, { merge: true });
    return resident;
  }

  async getResident(uid: string): Promise<Resident | null> {
    const doc = await adminDb.collection('residents').doc(uid).get();
    return doc.exists ? ({ ...doc.data(), id: doc.id } as Resident) : null;
  }

  /**
   * All active tenancies linked to this resident, matched by phone across every
   * PG. One resident can live in (or have a history with) multiple PGs.
   */
  async myTenancies(uid: string): Promise<Tenant[]> {
    const resident = await this.getResident(uid);
    if (!resident) throw new AppError(404, 'Resident profile not found');

    const snap = await adminDb
      .collection('tenants')
      .where('phone', '==', resident.phone)
      .limit(50)
      .get();

    return snap.docs
      .map((d) => ({ ...d.data(), id: d.id } as Tenant))
      .sort((a, b) => (a.deletedAt ? 1 : 0) - (b.deletedAt ? 1 : 0));
  }

  /** Assert a tenant belongs to this resident (phone match) and return it. */
  async assertOwnTenant(uid: string, tenantId: string): Promise<Tenant> {
    const resident = await this.getResident(uid);
    if (!resident) throw new AppError(404, 'Resident profile not found');
    const doc = await adminDb.collection('tenants').doc(tenantId).get();
    if (!doc.exists) throw new AppError(404, 'Tenancy not found');
    const tenant = { ...doc.data(), id: doc.id } as Tenant;
    if (cleanPhone(tenant.phone) !== resident.phone) {
      throw new AppError(403, 'Not your tenancy');
    }
    return tenant;
  }

  /**
   * DPDP data-access/portability: gather EVERYTHING this resident's account
   * holds — profile + every linked tenancy with its rent, deposits and
   * maintenance tickets. Returns owner-safe fields only (no portal tokens, no
   * other residents' data). Scoped strictly to the caller's own records.
   */
  async exportMyData(uid: string): Promise<Record<string, unknown>> {
    const resident = await this.getResident(uid);
    if (!resident) throw new AppError(404, 'Resident profile not found');
    const tenancies = await this.myTenancies(uid);

    const tenancyExports = await Promise.all(
      tenancies.map(async (t) => {
        const [rentSnap, depSnap, ticketSnap] = await Promise.all([
          adminDb.collection('rent_records').where('tenantId', '==', t.id).limit(100).get(),
          adminDb.collection('deposits').where('ownerId', '==', t.ownerId).where('tenantId', '==', t.id).limit(100).get(),
          adminDb.collection('maintenance_tickets').where('ownerId', '==', t.ownerId).where('tenantId', '==', t.id).limit(100).get(),
        ]);
        return {
          pg: t.ownerName || undefined,
          room: t.roomNumber,
          bed: t.bedLabel,
          moveInDate: t.moveInDate,
          moveOutDate: t.moveOutDate,
          rentRecords: rentSnap.docs.map((d) => {
            const r = d.data();
            return {
              period: r.period,
              amountDuePaise: r.amountDuePaise,
              amountPaidPaise: r.amountPaidPaise,
              status: r.status,
              receiptNumber: r.receiptNumber,
            };
          }),
          deposits: depSnap.docs.map((d) => {
            const x = d.data();
            return { type: x.type, amountPaise: x.amountPaise, reason: x.reason, refundStatus: x.refundStatus };
          }),
          maintenanceTickets: ticketSnap.docs.map((d) => {
            const x = d.data();
            return { category: x.category, description: x.description, status: x.status };
          }),
        };
      })
    );

    return {
      exportedAt: new Date().toISOString(),
      note: 'Your PGPass personal data (DPDP data-access request). Portal tokens and other residents’ data are never included.',
      profile: { name: resident.name, phone: resident.phone, email: resident.email },
      tenancies: tenancyExports,
    };
  }

  /** Resident email for a given phone (if they have a linked account), else null. */
  async emailForPhone(phone: string): Promise<string | null> {
    const clean = cleanPhone(phone);
    if (clean.length !== 10) return null;
    const snap = await adminDb.collection('residents').where('phone', '==', clean).limit(1).get();
    if (snap.empty) return null;
    const email = (snap.docs[0].data().email as string | undefined)?.trim();
    return email || null;
  }
}

export const residentsService = new ResidentsService();
