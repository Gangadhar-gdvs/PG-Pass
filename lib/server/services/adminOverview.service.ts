import 'server-only';
import { adminDb } from '../firebase-admin';
import { Owner, Bed, Tenant, RentRecord } from '@/types';
import { getCurrentPeriod } from '@/lib/utils';

export interface AdminStaffSummary {
  uid: string;
  name: string;
  email: string;
  phone: string;
  accountStatus: string;
  permissions: string[];
  ratingAvg: number;
  ratingCount: number;
  deleted: boolean;
}

export interface SuperAdminPgOverview {
  owner: Owner;
  totalBeds: number;
  occupiedBeds: number;
  paidBeds: number;
  pendingBeds: number;
  totalRevenuePotential: number;
  totalCollected: number;
  totalPending: number;
  tenantsCount: number;
  tenants: Tenant[];
  beds: Bed[];
  records: RentRecord[];
  staff: AdminStaffSummary[];
}

export interface SuperAdminPlatformOverview {
  allPgs: SuperAdminPgOverview[];
  platformTotalPgs: number;
  platformTotalBeds: number;
  platformTotalResidents: number;
  platformTotalVolume: number;
}

/**
 * Server-only super-admin platform overview.
 *
 * Replaces the former client-side `getSuperAdminPlatformOverview()` scan in
 * lib/firestore.ts, which ran unbounded `getDocs()` over every collection from
 * the browser and was gated by a client-exposed secret. This runs via the Admin
 * SDK behind `withAuth({ roles: ['admin'] })`, so authorization is a verified
 * custom claim, not a bundled string.
 *
 * NOTE: still an unbounded scan — acceptable at pilot scale. Past a few dozen
 * PGs this should read a precomputed nightly `metrics/{date}` document instead.
 */
export async function getPlatformOverview(): Promise<SuperAdminPlatformOverview> {
  const period = getCurrentPeriod();

  const [ownersSnap, bedsSnap, tenantsSnap, recordsSnap, staffSnap] = await Promise.all([
    adminDb.collection('owners').get(),
    adminDb.collection('beds').get(),
    adminDb.collection('tenants').get(),
    adminDb.collection('rent_records').where('period', '==', period).get(),
    adminDb.collection('staff').get(),
  ]);

  const owners = ownersSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Owner));
  const allBeds = bedsSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Bed));
  // Active residents = not soft-deleted. Filter in memory (not `== null`) so
  // legacy tenant docs that predate the `deletedAt` field are still counted.
  const allTenants = tenantsSnap.docs
    .map((d) => ({ ...d.data(), id: d.id } as Tenant))
    .filter((t) => !(t as any).deletedAt);
  const allRecords = recordsSnap.docs.map((d) => ({ ...d.data(), id: d.id } as RentRecord));
  const allStaff = staffSnap.docs.map((d) => ({ ...d.data(), id: d.id } as any));

  const allPgs: SuperAdminPgOverview[] = owners.map((owner) => {
    // Exclude soft-deleted beds from active inventory/stats.
    const pgBeds = allBeds.filter((b) => b.ownerId === owner.id && !(b as any).deletedAt);
    const pgTenants = allTenants.filter((t) => t.ownerId === owner.id);
    const pgRecords = allRecords.filter((r) => r.ownerId === owner.id);
    const pgStaff: AdminStaffSummary[] = allStaff
      .filter((s) => s.ownerId === owner.id)
      .map((s) => {
        const agg = s.ratingAgg || { count: 0, sum: 0 };
        return {
          uid: s.id,
          name: s.name || 'Staff',
          email: s.email || '',
          phone: s.phone || '',
          accountStatus: s.accountStatus || 'active',
          permissions: Array.isArray(s.permissions) ? s.permissions : [],
          ratingAvg: agg.count > 0 ? Math.round((agg.sum / agg.count) * 10) / 10 : 0,
          ratingCount: agg.count || 0,
          deleted: !!s.deletedAt,
        };
      });

    const recordMap = new Map<string, RentRecord>();
    pgRecords.forEach((r) => {
      if (r.bedId) recordMap.set(r.bedId, r);
    });

    let totalCollected = 0;
    let totalPending = 0;
    let paidBeds = 0;
    let pendingBeds = 0;

    pgBeds.forEach((bed) => {
      if (bed.status === 'vacant') return;
      const rec = recordMap.get(bed.id);
      const isPaid = bed.status === 'paid' || rec?.status === 'paid';
      if (isPaid) {
        paidBeds++;
        totalCollected += bed.monthlyRent || 0;
      } else {
        pendingBeds++;
        totalPending += bed.monthlyRent || 0;
      }
    });

    const occupiedBeds = pgBeds.filter((b) => b.status !== 'vacant').length;
    const totalRevenuePotential = pgBeds.reduce((sum, b) => sum + (b.monthlyRent || 0), 0);

    return {
      owner,
      totalBeds: pgBeds.length,
      occupiedBeds,
      paidBeds,
      pendingBeds,
      totalRevenuePotential,
      totalCollected,
      totalPending,
      tenantsCount: pgTenants.length,
      tenants: pgTenants,
      beds: pgBeds,
      records: pgRecords,
      staff: pgStaff,
    };
  });

  return {
    allPgs,
    platformTotalPgs: owners.length,
    platformTotalBeds: allBeds.filter((b) => !(b as any).deletedAt).length,
    platformTotalResidents: allTenants.length,
    platformTotalVolume: allPgs.reduce((acc, p) => acc + p.totalRevenuePotential, 0),
  };
}

/**
 * On-demand full history for one PG (admin only). Loaded when the admin opens a
 * PG so the platform overview stays light. Read-only — admin sees everything.
 */
export async function getPgAdminDetail(ownerId: string) {
  const [
    ownerSnap,
    recordsSnap,
    depositsSnap,
    expensesSnap,
    ticketsSnap,
    reviewsSnap,
    logsSnap,
  ] = await Promise.all([
    adminDb.collection('owners').doc(ownerId).get(),
    adminDb.collection('rent_records').where('ownerId', '==', ownerId).limit(200).get(),
    adminDb.collection('deposits').where('ownerId', '==', ownerId).limit(200).get(),
    adminDb.collection('expenses').where('ownerId', '==', ownerId).limit(200).get(),
    adminDb.collection('maintenance_tickets').where('ownerId', '==', ownerId).limit(200).get(),
    adminDb.collection('pg_reviews').where('ownerId', '==', ownerId).limit(100).get(),
    adminDb.collection('system_logs').where('ownerId', '==', ownerId).limit(100).get(),
  ]);

  const byCreatedDesc = (a: any, b: any) =>
    (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
  const map = (snap: any) => snap.docs.map((d: any) => ({ ...d.data(), id: d.id }));

  return {
    owner: ownerSnap.exists ? { ...ownerSnap.data(), id: ownerSnap.id } : null,
    rentRecords: map(recordsSnap).sort((a: any, b: any) => (b.period || '').localeCompare(a.period || '')),
    deposits: map(depositsSnap).sort(byCreatedDesc),
    // Surface soft-deleted expenses too (admin history), flagged.
    expenses: map(expensesSnap).sort(byCreatedDesc),
    maintenance: map(ticketsSnap).sort(byCreatedDesc),
    reviews: map(reviewsSnap).sort(byCreatedDesc),
    logs: map(logsSnap).sort(byCreatedDesc),
  };
}
