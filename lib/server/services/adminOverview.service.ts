import 'server-only';
import { adminDb } from '../firebase-admin';
import { Owner, Bed, Tenant, RentRecord } from '@/types';
import { getCurrentPeriod } from '@/lib/utils';
import { ACCOUNT_STATUS } from '@/lib/constants/status';

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
/**
 * Platform totals, read from the precomputed nightly `metrics/{date}` doc so the
 * admin HUD is O(1) regardless of platform size. Falls back to `count()`
 * aggregations (still cheap — no document payloads) if today's metrics doc
 * hasn't been written yet.
 */
async function getPlatformTotals(): Promise<{
  platformTotalPgs: number;
  platformTotalBeds: number;
  platformTotalResidents: number;
}> {
  const today = new Date().toISOString().slice(0, 10);
  const metricsSnap = await adminDb.collection('metrics').doc(today).get();
  if (metricsSnap.exists) {
    const m = metricsSnap.data() || {};
    return {
      platformTotalPgs: m.activeOwnersCount ?? 0,
      platformTotalBeds: m.totalBedsCount ?? 0,
      platformTotalResidents: m.activeResidentsCount ?? 0,
    };
  }
  // Fallback: aggregation counts (zero doc reads). Mirror the cron's filters
  // exactly (active owners, non-deleted tenants) so the "Total PGs" number is
  // consistent whether or not today's metrics doc has been written yet.
  const [ownersAgg, bedsAgg, tenantsAgg] = await Promise.all([
    adminDb.collection('owners').where('accountStatus', '==', ACCOUNT_STATUS.ACTIVE).count().get(),
    adminDb.collection('beds').count().get(),
    adminDb.collection('tenants').where('deletedAt', '==', null).count().get(),
  ]);
  return {
    platformTotalPgs: ownersAgg.data().count,
    platformTotalBeds: bedsAgg.data().count,
    platformTotalResidents: tenantsAgg.data().count,
  };
}

/**
 * Paginated super-admin overview.
 *
 * Previously this scanned EVERY owner/bed/tenant/staff doc into memory and did
 * O(owners × beds) in-memory joins — an OOM/timeout cliff past a few dozen PGs.
 * Now:
 *  - platform totals come from the precomputed metrics doc (O(1));
 *  - the owners list is PAGINATED (default 50);
 *  - per-PG detail is loaded only for the owners ON THIS PAGE, via targeted
 *    per-owner queries run concurrently — bounded work, no full-collection scan.
 *
 * `cursor` is the last owner id from the previous page (createdAt-desc order).
 */
export async function getPlatformOverview(
  pageSize = 50,
  cursor?: string
): Promise<SuperAdminPlatformOverview & { nextCursor: string | null }> {
  const period = getCurrentPeriod();
  const safeSize = Math.min(Math.max(pageSize, 1), 100);

  // 1. Platform totals (precomputed) + a bounded page of owners, concurrently.
  const [totals, ownersPage] = await Promise.all([
    getPlatformTotals(),
    (async () => {
      // Order by document id (`__name__`) — always present, so NO owner is
      // silently excluded (an `orderBy('createdAt')` would drop legacy docs that
      // predate that field). Gives stable cursor pagination.
      let q = adminDb.collection('owners').orderBy('__name__').limit(safeSize);
      if (cursor) q = q.startAfter(cursor);
      return q.get();
    })(),
  ]);

  const owners = ownersPage.docs.map((d) => ({ ...d.data(), id: d.id } as Owner));
  const nextCursor =
    owners.length === safeSize ? owners[owners.length - 1].id : null;

  // 2. For ONLY the owners on this page, load their beds/tenants/records/staff
  //    via per-owner queries in parallel. This is O(pageSize) targeted queries,
  //    not a full-collection scan.
  const allPgs: SuperAdminPgOverview[] = await Promise.all(
    owners.map(async (owner) => {
      const [bedsSnap, tenantsSnap, recordsSnap, staffSnap] = await Promise.all([
        adminDb.collection('beds').where('ownerId', '==', owner.id).where('deletedAt', '==', null).limit(500).get(),
        adminDb.collection('tenants').where('ownerId', '==', owner.id).where('deletedAt', '==', null).limit(500).get(),
        adminDb.collection('rent_records').where('ownerId', '==', owner.id).where('period', '==', period).limit(500).get(),
        adminDb.collection('staff').where('ownerId', '==', owner.id).limit(50).get(),
      ]);

      const pgBeds = bedsSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Bed));
      const pgTenants = tenantsSnap.docs.map((d) => ({ ...d.data(), id: d.id } as Tenant));
      const pgRecords = recordsSnap.docs.map((d) => ({ ...d.data(), id: d.id } as RentRecord));
      const pgStaff: AdminStaffSummary[] = staffSnap.docs
        .map((d) => ({ ...d.data(), id: d.id } as any))
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
    })
  );

  return {
    allPgs,
    // Platform totals come from the precomputed metrics (whole platform), NOT
    // from this page of owners.
    platformTotalPgs: totals.platformTotalPgs,
    platformTotalBeds: totals.platformTotalBeds,
    platformTotalResidents: totals.platformTotalResidents,
    // Volume across the PGs on this page (the full-platform volume isn't
    // precomputed; the HUD shows page volume which is the visible set).
    platformTotalVolume: allPgs.reduce((acc, p) => acc + p.totalRevenuePotential, 0),
    nextCursor,
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
