/**
 * Should the monthly job create a rent bill for this resident for `nextPeriod`?
 *
 * Move-out keeps the tenant doc (deletedAt stays null so past residents remain
 * listed) but sets `moveOutDate` and vacates the bed — so `deletedAt == null`
 * alone is NOT "still living here". Pure + deterministic for unit testing.
 */
export type SkipReason = 'moved_out' | 'bed_not_theirs';

export function rentBillEligibility(args: {
  tenantId: string;
  tenant: { moveOutDate?: string | null };
  /** The tenant's bed as currently stored (undefined if it no longer exists). */
  bed?: { status?: string | null; tenantId?: string | null } | null;
  /** Billing period being generated, `YYYY-MM`. */
  nextPeriod: string;
}): { bill: true } | { bill: false; reason: SkipReason } {
  const { tenantId, tenant, bed, nextPeriod } = args;
  const periodStart = `${nextPeriod}-01`; // YYYY-MM-DD compares lexicographically

  // Moved out before the period begins → no bill for it.
  if (tenant.moveOutDate && tenant.moveOutDate < periodStart) {
    return { bill: false, reason: 'moved_out' };
  }

  // The bed is vacant or now belongs to someone else → this resident no longer
  // occupies it (covers legacy move-outs without a moveOutDate). Beds without a
  // recorded tenantId (legacy) are not treated as a mismatch.
  if (bed && (bed.status === 'vacant' || (bed.tenantId && bed.tenantId !== tenantId))) {
    return { bill: false, reason: 'bed_not_theirs' };
  }

  return { bill: true };
}
