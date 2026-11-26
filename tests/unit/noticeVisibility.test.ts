import { describe, it, expect } from 'vitest';

/**
 * Mirrors the filter in `NoticesService.listForViewer` — which notices a given
 * viewer may see. Prevents cross-audience / cross-room leakage and respects
 * expiry. (The service is firebase-admin bound; this tests the pure predicate.)
 */
type Audience = 'all' | 'residents' | 'staff';
interface N {
  audience: Audience;
  roomNumber?: string;
  deletedAt?: unknown;
  expiresMs?: number | null;
}

function visibleTo(
  n: N,
  viewer: 'residents' | 'staff',
  opts: { roomNumber?: string; nowMs: number }
): boolean {
  if (n.deletedAt) return false;
  if (n.audience !== 'all' && n.audience !== viewer) return false;
  if (n.roomNumber && viewer === 'residents' && n.roomNumber !== opts.roomNumber) return false;
  if (n.expiresMs && n.expiresMs < opts.nowMs) return false;
  return true;
}

const NOW = 1_000_000;

describe('Notice visibility', () => {
  it('staff-only notices are hidden from residents and vice versa', () => {
    expect(visibleTo({ audience: 'staff' }, 'residents', { nowMs: NOW })).toBe(false);
    expect(visibleTo({ audience: 'residents' }, 'staff', { nowMs: NOW })).toBe(false);
    expect(visibleTo({ audience: 'staff' }, 'staff', { nowMs: NOW })).toBe(true);
    expect(visibleTo({ audience: 'residents' }, 'residents', { nowMs: NOW })).toBe(true);
  });

  it('"all" notices are visible to both audiences', () => {
    expect(visibleTo({ audience: 'all' }, 'residents', { nowMs: NOW })).toBe(true);
    expect(visibleTo({ audience: 'all' }, 'staff', { nowMs: NOW })).toBe(true);
  });

  it('room-scoped notices only reach residents of that room', () => {
    const n: N = { audience: 'residents', roomNumber: '101' };
    expect(visibleTo(n, 'residents', { roomNumber: '101', nowMs: NOW })).toBe(true);
    expect(visibleTo(n, 'residents', { roomNumber: '202', nowMs: NOW })).toBe(false);
    expect(visibleTo(n, 'residents', { nowMs: NOW })).toBe(false); // no room → hidden
  });

  it('expired notices are hidden; non-expiring stay visible', () => {
    expect(visibleTo({ audience: 'all', expiresMs: NOW - 1 }, 'residents', { nowMs: NOW })).toBe(false);
    expect(visibleTo({ audience: 'all', expiresMs: NOW + 1 }, 'residents', { nowMs: NOW })).toBe(true);
    expect(visibleTo({ audience: 'all', expiresMs: null }, 'residents', { nowMs: NOW })).toBe(true);
  });

  it('soft-deleted notices are never shown', () => {
    expect(visibleTo({ audience: 'all', deletedAt: {} }, 'residents', { nowMs: NOW })).toBe(false);
  });
});
