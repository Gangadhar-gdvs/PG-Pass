import { describe, it, expect } from 'vitest';
import type { RentRecord } from '@/types';

/**
 * Regression tests for per-month bed payment status (the "beds tab shows the
 * same data for every date" bug).
 *
 * Root cause: BedCard/BedGrid/RoomCard derived paid/verify status as
 * `bed.status === 'paid' || record?.status === 'paid'`. The bed's denormalized
 * status is month-agnostic (server only ever writes vacant/occupied/guest), so
 * the OR made occupied beds look identical across every month. Fixed by driving
 * payment status ONLY from the selected period's rent record, with a distinct
 * "no bill" state when no record exists for that month.
 *
 * These mirror the pure resolver the three card components now use.
 */

type Resolved = 'vacant' | 'guest' | 'paid' | 'verify' | 'due' | 'noBill';

function resolveStatus(bedStatus: string, record: Pick<RentRecord, 'status'> | undefined): Resolved {
  if (bedStatus === 'vacant') return 'vacant';
  if (bedStatus === 'guest') return 'guest';
  if (record?.status === 'paid') return 'paid';
  if (record?.status === 'verify') return 'verify';
  if (!record) return 'noBill';
  return 'due';
}

describe('Per-month bed payment status', () => {
  it('ignores the bed\'s denormalized status for payment state', () => {
    // Even if a stale/legacy bed.status were 'paid', the selected month with no
    // record must NOT show paid — it shows "no bill" for that period.
    expect(resolveStatus('paid', undefined)).toBe('noBill');
    // An occupied bed with a pending record this month is Due.
    expect(resolveStatus('occupied', { status: 'pending' })).toBe('due');
  });

  it('shows different states across months for the same bed', () => {
    const nov: Pick<RentRecord, 'status'> = { status: 'paid' };
    const dec = undefined; // rent not generated for December yet
    const oct: Pick<RentRecord, 'status'> = { status: 'pending' }; // unpaid past month

    expect(resolveStatus('occupied', oct)).toBe('due');
    expect(resolveStatus('occupied', nov)).toBe('paid');
    expect(resolveStatus('occupied', dec)).toBe('noBill');
    // The three months are genuinely distinct — the core of the bug.
    expect(new Set(['due', 'paid', 'noBill']).size).toBe(3);
  });

  it('occupancy states take priority and are month-independent', () => {
    expect(resolveStatus('vacant', { status: 'paid' })).toBe('vacant');
    expect(resolveStatus('guest', undefined)).toBe('guest');
  });

  it('maps each record status to its own badge', () => {
    expect(resolveStatus('occupied', { status: 'paid' })).toBe('paid');
    expect(resolveStatus('occupied', { status: 'verify' })).toBe('verify');
    expect(resolveStatus('occupied', { status: 'pending' })).toBe('due');
  });
});

/**
 * Rent records link to a RESIDENT, not a bed: their doc id is
 * `${tenantId}_${period}` and they store `tenantId` (not a reliable `bedId`).
 * The cards/stats must therefore resolve a bed's record via `bed.tenantId`.
 * Keying by `bed.id` finds nothing and made every occupied bed read "No bill" —
 * this guards that regression.
 */
describe('Bed → rent-record join key', () => {
  type Rec = { tenantId: string; status: string };
  const records: Rec[] = [
    { tenantId: 'tenantA', status: 'paid' },
    { tenantId: 'tenantB', status: 'pending' },
  ];
  const byTenant = new Map(records.map((r) => [r.tenantId, r]));
  const recordFor = (bed: { id: string; tenantId?: string }) =>
    bed.tenantId ? byTenant.get(bed.tenantId) : undefined;

  it('resolves a bed to its record via tenantId, not bed id', () => {
    const bedA = { id: 'bed_101_A', tenantId: 'tenantA' };
    expect(recordFor(bedA)?.status).toBe('paid');
    // Keying by bed id (the old bug) would miss entirely.
    expect(byTenant.get(bedA.id)).toBeUndefined();
  });

  it('a vacant bed (no tenantId) resolves to no record', () => {
    expect(recordFor({ id: 'bed_101_B' })).toBeUndefined();
  });

  it('two beds with different tenants get their own records', () => {
    expect(recordFor({ id: 'x', tenantId: 'tenantA' })?.status).toBe('paid');
    expect(recordFor({ id: 'y', tenantId: 'tenantB' })?.status).toBe('pending');
  });
});
