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
}

export const residentsService = new ResidentsService();
