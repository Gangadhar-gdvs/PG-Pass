import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FakeDb } from './helpers/fakeFirestore';

/**
 * utilities.service against an in-memory Firestore: duplicate detection, meter
 * validation, apply-to-rent (idempotent, paid → pending, skip reasons), void
 * (remove vs negative adjustment, audit log) and tenant isolation.
 */

vi.mock('@/lib/server/firebase-admin', async () => {
  const { createFakeDb } = await import('./helpers/fakeFirestore');
  return { adminDb: createFakeDb() };
});
vi.mock('@/lib/server/services/systemLogs.service', () => ({
  recordEvent: async () => {},
  recordSystemLog: async () => null,
}));

const { adminDb } = await import('@/lib/server/firebase-admin');
const { utilitiesService } = await import('@/lib/server/services/utilities.service');
const { utilityBillInputSchema } = await import('@/lib/validation');
const db = adminDb as unknown as FakeDb;

const A = 'ownerA';
const B = 'ownerB';
const P = '2026-11';

function tenant(id: string, name: string, extra: Record<string, unknown> = {}) {
  return {
    ownerId: A,
    propertyId: A,
    name,
    roomNumber: '101',
    bedLabel: `101-${id}`,
    bedId: `bed_${id}`,
    moveInDate: '2026-01-01',
    deletedAt: null,
    ...extra,
  };
}

function rent(tenantId: string, extra: Record<string, unknown> = {}) {
  return {
    id: `${tenantId}_${P}`,
    ownerId: A,
    propertyId: A,
    tenantId,
    period: P,
    lineItems: [{ label: 'Base Rent', amountPaise: 500_000 }],
    amountDuePaise: 500_000,
    amountPaidPaise: 0,
    status: 'pending',
    dueDate: `${P}-05`,
    ...extra,
  };
}

const baseInput = {
  type: 'electricity' as const,
  period: P,
  scope: 'room' as const,
  roomNumber: '101',
  totalPaise: 300_000,
  rule: 'equal' as const,
};

type Rec = { lineItems: Array<{ label: string; amountPaise: number; kind?: string }>; amountDuePaise: number; status: string };
const rec = (tenantId: string) => db.read('rent_records', `${tenantId}_${P}`) as unknown as Rec;
const sumLines = (r: Rec) => r.lineItems.reduce((s, li) => s + li.amountPaise, 0);

beforeEach(() => {
  db.reset();
  db.seed('tenants', 't1', tenant('t1', 'Asha'));
  db.seed('tenants', 't2', tenant('t2', 'Bala'));
  db.seed('tenants', 't3', tenant('t3', 'Chitra'));
  db.seed('tenants', 'tOther', tenant('tOther', 'Other room', { roomNumber: '102' }));
  db.seed('tenants', 'tGone', tenant('tGone', 'Deleted', { deletedAt: { toMillis: () => 1 } }));
  db.seed('tenants', 'tB', { ...tenant('tB', 'Owner B resident'), ownerId: B, propertyId: B });
  db.seed('rent_records', `t1_${P}`, rent('t1'));
  db.seed('rent_records', `t2_${P}`, rent('t2', { status: 'paid', amountPaidPaise: 500_000, receiptNumber: 7 }));
  db.seed('rent_records', `t3_${P}`, rent('t3'));
});

describe('create + duplicate detection', () => {
  it('saves a draft with a frozen allocation for the room residents only', async () => {
    const bill = await utilitiesService.create(A, A, baseInput);
    expect(bill.status).toBe('draft');
    expect(bill.label).toBe('Electricity · Room 101 · Nov 2026');
    expect(bill.allocations.map((a) => a.tenantId)).toEqual(['t1', 't2', 't3']); // not 102, not deleted, not owner B
    expect(bill.allocations.reduce((s, a) => s + a.sharePaise, 0)).toBe(300_000);
    expect(db.all('utility_bills')[0]).toHaveProperty('dedupeKey'); // stored…
    expect(bill).not.toHaveProperty('dedupeKey'); // …but never in the DTO
  });

  it('rejects a duplicate bill (same scope + type + period) with 409', async () => {
    await utilitiesService.create(A, A, baseInput);
    await expect(utilitiesService.create(A, A, { ...baseInput, totalPaise: 1 })).rejects.toMatchObject({ statusCode: 409 });
    // Different type or room is not a duplicate.
    await expect(utilitiesService.create(A, A, { ...baseInput, type: 'water' })).resolves.toBeTruthy();
    // Room numbers are trimmed before the duplicate comparison.
    db.seed('tenants', 'g1', tenant('g1', 'Gita', { roomNumber: 'G-1' }));
    await utilitiesService.create(A, A, { ...baseInput, roomNumber: 'G-1' });
    await expect(utilitiesService.create(A, A, { ...baseInput, roomNumber: ' G-1 ' })).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('allows re-recording once the previous bill is voided (soft-deleted)', async () => {
    const first = await utilitiesService.create(A, A, baseInput);
    await utilitiesService.void(A, A, first.id, 'Wrong amount entered');
    await expect(utilitiesService.create(A, A, baseInput)).resolves.toMatchObject({ status: 'draft' });
  });

  it('rejects a meter reading lower than the previous one, unless flagged reset', async () => {
    await expect(
      utilitiesService.create(A, A, { ...baseInput, meter: { previous: 900, current: 100 } })
    ).rejects.toMatchObject({ statusCode: 400, code: 'METER_READING_LOWER' });
    const ok = await utilitiesService.create(A, A, { ...baseInput, meter: { previous: 900, current: 100, reset: true } });
    expect(ok.meter).toEqual({ previous: 900, current: 100, units: 100, reset: true });
  });

  it('custom amounts that do not add up are rejected (400)', async () => {
    await expect(
      utilitiesService.create(A, A, { ...baseInput, rule: 'custom', customPaise: { t1: 100_000, t2: 100_000 } })
    ).rejects.toMatchObject({ statusCode: 400, code: 'CUSTOM_SUM_MISMATCH' });
  });

  it('a ₹0 bill is complete as saved and never touches rent', async () => {
    const bill = await utilitiesService.create(A, A, { ...baseInput, totalPaise: 0 });
    expect(bill.status).toBe('applied');
    const before = rec('t1');
    await utilitiesService.apply(A, A, bill.id);
    expect(rec('t1')).toEqual(before);
  });
});

describe('apply to rent', () => {
  it('appends one line per share, raises amountDue, keeps lineItems consistent', async () => {
    const bill = await utilitiesService.create(A, A, baseInput);
    const { bill: after, result } = await utilitiesService.apply(A, A, bill.id);

    expect(result.charged).toHaveLength(3);
    expect(after.status).toBe('applied');
    for (const t of ['t1', 't2', 't3']) {
      const r = rec(t);
      expect(r.lineItems).toHaveLength(2);
      expect(r.lineItems[1]).toMatchObject({ label: 'Electricity · Room 101 · Nov 2026', amountPaise: 100_000, kind: 'utility' });
      expect(r.amountDuePaise).toBe(600_000);
      expect(sumLines(r)).toBe(r.amountDuePaise);
    }
  });

  it('a fully-paid record goes back to pending (never silently paid)', async () => {
    const bill = await utilitiesService.create(A, A, baseInput);
    const { result } = await utilitiesService.apply(A, A, bill.id);
    const r2 = db.read('rent_records', `t2_${P}`)!;
    expect(r2.status).toBe('pending');
    expect(r2.amountPaidPaise).toBe(500_000); // payment history kept → partially paid
    expect(result.charged.find((c) => c.tenantName === 'Bala')?.reopenedPaid).toBe(true);
  });

  it('is idempotent: re-applying never double-charges', async () => {
    const bill = await utilitiesService.create(A, A, baseInput);
    await utilitiesService.apply(A, A, bill.id);
    const snapshot = ['t1', 't2', 't3'].map(rec);

    const again = await utilitiesService.apply(A, A, bill.id);
    expect(again.result.charged).toHaveLength(0);
    expect(again.result.alreadyApplied).toBe(3);
    expect(['t1', 't2', 't3'].map(rec)).toEqual(snapshot);
  });

  it('skips (with a reason) residents without a rent record or with a pending verification, then picks them up later', async () => {
    db.col('rent_records').delete(`t3_${P}`);
    db.seed('rent_records', `t1_${P}`, rent('t1', { status: 'verify' }));
    const bill = await utilitiesService.create(A, A, baseInput);

    const first = await utilitiesService.apply(A, A, bill.id);
    expect(first.bill.status).toBe('partial');
    expect(first.result.charged.map((c) => c.tenantName)).toEqual(['Bala']);
    expect(first.result.skipped.map((s) => s.tenantName).sort()).toEqual(['Asha', 'Chitra']);
    expect(first.result.skipped.find((s) => s.tenantName === 'Chitra')?.reason).toMatch(/No rent record/);
    expect(db.read('rent_records', `t3_${P}`)).toBeUndefined(); // never invents a rent bill

    // Owner verifies Asha's claim and creates Chitra's rent → re-apply charges only those two.
    db.seed('rent_records', `t1_${P}`, rent('t1', { status: 'paid', amountPaidPaise: 500_000 }));
    db.seed('rent_records', `t3_${P}`, rent('t3'));
    const second = await utilitiesService.apply(A, A, bill.id);
    expect(second.result.charged.map((c) => c.tenantName).sort()).toEqual(['Asha', 'Chitra']);
    expect(second.result.alreadyApplied).toBe(1);
    expect(second.bill.status).toBe('applied');
    expect(rec('t2').lineItems.filter((li) => li.kind === 'utility')).toHaveLength(1); // Bala still charged once
  });
});

describe('void / reversal', () => {
  it('removes the line from unpaid records and appends a negative adjustment where paid', async () => {
    const bill = await utilitiesService.create(A, A, baseInput);
    await utilitiesService.apply(A, A, bill.id);
    // Bala then pays the full new balance (₹6,000) → paid.
    db.seed('rent_records', `t2_${P}`, { ...db.read('rent_records', `t2_${P}`)!, status: 'paid', amountPaidPaise: 600_000 });

    const { bill: voided, result } = await utilitiesService.void(A, A, bill.id, 'Meter misread');
    expect(voided.status).toBe('void');
    expect(voided.deletedAt).toBeTruthy();
    expect(result.removed).toBe(2); // Asha + Chitra (nothing paid)
    expect(result.adjusted).toBe(1); // Bala (had payments)
    expect(result.credits).toEqual([{ tenantName: 'Bala', paise: 100_000 }]);

    const r1 = rec('t1');
    expect(r1.lineItems).toEqual([{ label: 'Base Rent', amountPaise: 500_000 }]);
    expect(r1.amountDuePaise).toBe(500_000);

    const r2 = rec('t2');
    expect(r2.lineItems.map((li) => li.amountPaise)).toEqual([500_000, 100_000, -100_000]); // history kept
    expect(r2.amountDuePaise).toBe(500_000);
    expect(sumLines(r2)).toBe(r2.amountDuePaise);
    expect(r2.status).toBe('paid'); // not touched

    expect(db.all('audit_logs')).toHaveLength(1);
    expect(db.all('audit_logs')[0]).toMatchObject({ action: 'void_utility_bill', targetId: bill.id, reason: 'Meter misread' });
  });

  it('cannot be voided twice or applied after voiding', async () => {
    const bill = await utilitiesService.create(A, A, baseInput);
    await utilitiesService.void(A, A, bill.id, 'Duplicate entry');
    await expect(utilitiesService.void(A, A, bill.id, 'Again please')).rejects.toMatchObject({ statusCode: 409 });
    await expect(utilitiesService.apply(A, A, bill.id)).rejects.toMatchObject({ statusCode: 409 });
  });

  it('requires a reason', async () => {
    const bill = await utilitiesService.create(A, A, baseInput);
    await expect(utilitiesService.void(A, A, bill.id, ' ')).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('tenant isolation', () => {
  it("owner B cannot read, apply or void owner A's bill (403) and nothing is written", async () => {
    const bill = await utilitiesService.create(A, A, baseInput);
    const writesBefore = db.writes;
    await expect(utilitiesService.get(B, bill.id)).rejects.toMatchObject({ statusCode: 403 });
    await expect(utilitiesService.apply(B, B, bill.id)).rejects.toMatchObject({ statusCode: 403 });
    await expect(utilitiesService.void(B, B, bill.id, 'malicious')).rejects.toMatchObject({ statusCode: 403 });
    expect(db.writes).toBe(writesBefore);
    expect(rec('t1').lineItems).toHaveLength(1);
  });

  it("owner B's listing never includes owner A's bills", async () => {
    await utilitiesService.create(A, A, baseInput);
    expect(await utilitiesService.list(B, P)).toEqual([]);
    expect(await utilitiesService.list(A, P)).toHaveLength(1);
  });

  it('a missing bill is a 404', async () => {
    await expect(utilitiesService.get(A, 'nope')).rejects.toMatchObject({ statusCode: 404 });
    await expect(utilitiesService.apply(A, A, 'nope')).rejects.toMatchObject({ statusCode: 404 });
    await expect(utilitiesService.void(A, A, 'nope', 'reason')).rejects.toMatchObject({ statusCode: 404 });
  });

  it("owner B's custom split cannot target owner A's residents", async () => {
    await expect(
      utilitiesService.create(B, B, { ...baseInput, rule: 'custom', totalPaise: 100, customPaise: { t1: 100 } })
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('preview (dry run)', () => {
  it('returns residents, split and a duplicate warning without writing', async () => {
    await utilitiesService.create(A, A, baseInput);
    const writes = db.writes;
    const p = await utilitiesService.preview(A, { ...baseInput, rule: 'custom', customPaise: { t1: 1 } });
    expect(db.writes).toBe(writes);
    expect(p.residents.map((r) => r.tenantId).sort()).toEqual(['t1', 't2', 't3']);
    expect(p.split).toBeNull();
    expect(p.error).toMatch(/short of the bill total/);
    expect(p.duplicate).not.toBeNull();
  });

  it('warns when a whole-PG bill overlaps a room bill of the same type', async () => {
    await utilitiesService.create(A, A, baseInput);
    const p = await utilitiesService.preview(A, { ...baseInput, scope: 'property', roomNumber: undefined });
    expect(p.overlaps).toHaveLength(1);
  });
});

describe('input schema', () => {
  it('requires a room for room scope and rejects negative / fractional paise', () => {
    expect(utilityBillInputSchema.safeParse({ ...baseInput, roomNumber: undefined }).success).toBe(false);
    expect(utilityBillInputSchema.safeParse({ ...baseInput, totalPaise: -1 }).success).toBe(false);
    expect(utilityBillInputSchema.safeParse({ ...baseInput, totalPaise: 10.5 }).success).toBe(false);
    expect(utilityBillInputSchema.safeParse({ ...baseInput, period: '2026-13' }).success).toBe(false);
    expect(utilityBillInputSchema.safeParse(baseInput).success).toBe(true);
  });
});
