import { describe, it, expect } from 'vitest';
import { rentBillEligibility } from '@/lib/rentEligibility';

const base = { tenantId: 't1', nextPeriod: '2026-12' };

describe('rentBillEligibility (monthly rent generation)', () => {
  it('bills a resident who still occupies their bed', () => {
    expect(rentBillEligibility({ ...base, tenant: {}, bed: { status: 'occupied', tenantId: 't1' } })).toEqual({ bill: true });
  });

  it('does not bill a resident who moved out before the period starts', () => {
    expect(rentBillEligibility({ ...base, tenant: { moveOutDate: '2026-11-20' }, bed: { status: 'vacant' } })).toEqual({
      bill: false,
      reason: 'moved_out',
    });
    // Moving out on the last day of the previous month also means no December bill.
    expect(rentBillEligibility({ ...base, tenant: { moveOutDate: '2026-11-30' } })).toMatchObject({ bill: false });
  });

  it('still bills a resident whose move-out is scheduled within/after the period', () => {
    expect(rentBillEligibility({ ...base, tenant: { moveOutDate: '2026-12-01' }, bed: { status: 'occupied', tenantId: 't1' } })).toEqual({ bill: true });
    expect(rentBillEligibility({ ...base, tenant: { moveOutDate: '2027-01-15' }, bed: { status: 'occupied', tenantId: 't1' } })).toEqual({ bill: true });
  });

  it('does not bill when the bed is vacant or re-let to someone else (legacy move-outs)', () => {
    expect(rentBillEligibility({ ...base, tenant: {}, bed: { status: 'vacant', tenantId: null } })).toEqual({
      bill: false,
      reason: 'bed_not_theirs',
    });
    expect(rentBillEligibility({ ...base, tenant: {}, bed: { status: 'occupied', tenantId: 't2' } })).toEqual({
      bill: false,
      reason: 'bed_not_theirs',
    });
  });

  it('does not treat legacy beds without a recorded tenantId as a mismatch', () => {
    expect(rentBillEligibility({ ...base, tenant: {}, bed: { status: 'occupied' } })).toEqual({ bill: true });
    expect(rentBillEligibility({ ...base, tenant: {}, bed: undefined })).toEqual({ bill: true });
  });
});
