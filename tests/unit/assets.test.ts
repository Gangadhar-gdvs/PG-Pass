import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FakeDb } from './helpers/fakeFirestore';
import { summarizeAssets, warrantyStatus, historyEntriesFor, istTodayIso } from '@/lib/assets';
import type { Asset } from '@/types';

/** Room inventory: append-only condition history, summary maths, tenant isolation. */

vi.mock('@/lib/server/firebase-admin', async () => {
  const { createFakeDb } = await import('./helpers/fakeFirestore');
  return { adminDb: createFakeDb() };
});
vi.mock('@/lib/server/services/systemLogs.service', () => ({
  recordEvent: async () => {},
  recordSystemLog: async () => null,
}));

const { adminDb } = await import('@/lib/server/firebase-admin');
const { assetsService } = await import('@/lib/server/services/assets.service');
const { createAssetSchema, updateAssetSchema } = await import('@/lib/validation');
const db = adminDb as unknown as FakeDb;

const A = 'ownerA';
const B = 'ownerB';
const owner = { uid: A, role: 'owner' };
const staff = { uid: 'staff1', role: 'staff' };

const chair = {
  location: 'room' as const,
  roomNumber: '101',
  name: 'Study chair',
  category: 'furniture' as const,
  quantity: 2,
};

beforeEach(() => db.reset());

describe('asset condition history (append-only)', () => {
  it('records creation, then appends condition and quantity changes without rewriting the past', async () => {
    const created = await assetsService.create(A, owner, chair);
    expect(created.condition).toBe('good');
    expect(created.history).toHaveLength(1);
    expect(created.history[0]).toMatchObject({ action: 'created', toCondition: 'good', toQuantity: 2, by: A });

    const damaged = await assetsService.update(A, staff, created.id, { condition: 'damaged', note: 'Leg broken' });
    expect(damaged.condition).toBe('damaged');
    expect(damaged.history).toHaveLength(2);
    expect(damaged.history[0]).toEqual(created.history[0]); // untouched
    expect(damaged.history[1]).toMatchObject({
      action: 'condition',
      fromCondition: 'good',
      toCondition: 'damaged',
      by: 'staff1',
      byRole: 'staff',
      note: 'Leg broken',
    });

    const fewer = await assetsService.update(A, owner, created.id, { quantity: 1, condition: 'missing' });
    expect(fewer.history.map((h) => h.action)).toEqual(['created', 'condition', 'condition', 'quantity']);
    expect(fewer.history[3]).toMatchObject({ fromQuantity: 2, toQuantity: 1 });
    expect(fewer.history.slice(0, 2)).toEqual(damaged.history);

    // Persisted, not just returned.
    expect((db.read('assets', created.id)!.history as unknown[]).length).toBe(4);
  });

  it('a no-op edit writes nothing', async () => {
    const created = await assetsService.create(A, owner, chair);
    const writes = db.writes;
    const same = await assetsService.update(A, owner, created.id, { condition: 'good', quantity: 2 });
    expect(same.history).toHaveLength(1);
    expect(db.writes).toBe(writes);
  });

  it('soft delete keeps the record and appends a deleted entry', async () => {
    const created = await assetsService.create(A, owner, chair);
    await assetsService.softDelete(A, owner, created.id);
    const stored = db.read('assets', created.id)!;
    expect(stored.deletedAt).toBeTruthy();
    expect((stored.history as Array<{ action: string }>).at(-1)?.action).toBe('deleted');
    expect((await assetsService.list(A)).assets).toHaveLength(0);
    await expect(assetsService.update(A, owner, created.id, { condition: 'fair' })).rejects.toMatchObject({ statusCode: 404 });
  });

  it('never allows negative quantity or a warranty ending before purchase', async () => {
    const created = await assetsService.create(A, owner, { ...chair, purchaseDate: '2026-01-10' });
    await expect(assetsService.update(A, owner, created.id, { quantity: -1 })).rejects.toMatchObject({ statusCode: 400 });
    await expect(assetsService.update(A, owner, created.id, { warrantyUntil: '2025-12-31' })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(updateAssetSchema.safeParse({ quantity: -1 }).success).toBe(false);
    expect(createAssetSchema.safeParse({ ...chair, quantity: 0 }).success).toBe(false);
    expect(createAssetSchema.safeParse({ ...chair, roomNumber: undefined }).success).toBe(false);
    expect(createAssetSchema.safeParse({ ...chair, location: 'common', roomNumber: undefined }).success).toBe(true);
  });
});

describe('asset tenant isolation', () => {
  it("owner B cannot read, edit or delete owner A's asset (403); nothing is written", async () => {
    const created = await assetsService.create(A, owner, chair);
    const writes = db.writes;
    await expect(assetsService.get(B, created.id)).rejects.toMatchObject({ statusCode: 403 });
    await expect(assetsService.update(B, { uid: B, role: 'owner' }, created.id, { condition: 'missing' })).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(assetsService.softDelete(B, { uid: B, role: 'owner' }, created.id)).rejects.toMatchObject({ statusCode: 403 });
    expect(db.writes).toBe(writes);
    expect((await assetsService.list(B)).assets).toEqual([]);
  });

  it('a missing asset is a 404', async () => {
    await expect(assetsService.get(A, 'nope')).rejects.toMatchObject({ statusCode: 404 });
    await expect(assetsService.update(A, owner, 'nope', { condition: 'fair' })).rejects.toMatchObject({ statusCode: 404 });
    await expect(assetsService.softDelete(A, owner, 'nope')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('inventory summary', () => {
  const today = '2026-11-27';
  const item = (condition: Asset['condition'], quantity: number, warrantyUntil: string | null = null) => ({
    condition,
    quantity,
    warrantyUntil,
  });

  it('counts by condition, needs-attention and warranties expiring within 30 days', () => {
    const s = summarizeAssets(
      [
        item('good', 2, '2026-12-20'), // expiring (23 days)
        item('good', 1, '2026-12-27'), // expiring (exactly 30 days)
        item('fair', 1, '2026-12-28'), // 31 days → not yet
        item('damaged', 1, '2026-11-26'), // expired yesterday → not "expiring"
        item('missing', 3),
      ],
      today
    );
    expect(s.byCondition).toEqual({ good: 2, fair: 1, damaged: 1, missing: 1 });
    expect(s.entries).toBe(5);
    expect(s.totalQuantity).toBe(8);
    expect(s.needsAttention).toBe(2);
    expect(s.warrantyExpiringSoon).toBe(2);
  });

  it('classifies warranty status and IST "today"', () => {
    expect(warrantyStatus(null, today)).toBe('none');
    expect(warrantyStatus('2026-11-27', today)).toBe('expiring');
    expect(warrantyStatus('2026-11-26', today)).toBe('expired');
    expect(warrantyStatus('2027-06-01', today)).toBe('active');
    // 20:00 UTC on the 26th is already the 27th in India.
    expect(istTodayIso(Date.UTC(2026, 10, 26, 20, 0))).toBe('2026-11-27');
  });

  it('history diff only emits entries for real changes', () => {
    const current = {
      name: 'Fan',
      category: 'electrical' as const,
      quantity: 1,
      condition: 'good' as const,
      purchaseDate: null,
      warrantyUntil: null,
      notes: null,
    };
    const actor = { uid: 'u', role: 'owner' };
    expect(historyEntriesFor(current, { name: 'Fan', notes: null }, actor, 'now')).toEqual([]);
    expect(historyEntriesFor(current, { name: 'Ceiling fan' }, actor, 'now')[0]).toMatchObject({
      action: 'updated',
      fields: ['name'],
    });
  });
});
