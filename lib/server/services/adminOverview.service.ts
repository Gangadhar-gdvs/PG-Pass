import 'server-only';
import { adminDb } from '../firebase-admin';
import { Owner, Bed, Tenant, RentRecord } from '@/types';
import { getCurrentPeriod } from '@/lib/utils';

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

  const [ownersSnap, bedsSnap, tenantsSnap, recordsSnap] = await Promise.all([
    adminDb.collection('owners').get(),
    adminDb.collection('beds').get(),
    // Active residents are those not soft-deleted (there is no `active` field).
    adminDb.collection('tenants').where('deletedAt', '==', null).get(),
    adminDb.collection('rent_records').where('period', '==', period).get(),
  ]);

  const owners = ownersSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Owner));
  const allBeds = bedsSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Bed));
  const allTenants = tenantsSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Tenant));
  const allRecords = recordsSnap.docs.map((d) => ({ ...d.data(), id: d.id } as RentRecord));

  const allPgs: SuperAdminPgOverview[] = owners.map((owner) => {
    const pgBeds = allBeds.filter((b) => b.ownerId === owner.id);
    const pgTenants = allTenants.filter((t) => t.ownerId === owner.id);
    const pgRecords = allRecords.filter((r) => r.ownerId === owner.id);

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
    };
  });

  return {
    allPgs,
    platformTotalPgs: owners.length,
    platformTotalBeds: allBeds.length,
    platformTotalResidents: allTenants.length,
    platformTotalVolume: allPgs.reduce((acc, p) => acc + p.totalRevenuePotential, 0),
  };
}
