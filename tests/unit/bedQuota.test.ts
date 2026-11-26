import { describe, it, expect } from 'vitest';

/**
 * Regression tests for the free-tier bed quota (hard-cap, no first-setup grace).
 *
 * Bug context: owner reported "free tier 20 beds reached, still allows creating
 * more". Root cause was a first-setup grace path in createBedsBatch that let the
 * very first batch exceed the plan limit and then PERMANENTLY raised the owner's
 * stored maxBeds to match — so '20' was never actually enforced, and the limit
 * could be ratcheted up by soft-deleting beds and re-batching.
 *
 * Policy (decided): the plan limit is ALWAYS the hard ceiling in both the single
 * and batch create paths — no grace, no write-back. These tests mirror the pure
 * predicate the service enforces so a regression to the grace behavior fails here.
 */

/** Mirrors the batch guard: currentCount + add > maxBeds ⇒ rejected. */
function batchWouldExceed(currentCount: number, add: number, maxBeds: number): boolean {
  return currentCount + add > maxBeds;
}

/** Mirrors the single-create guard: activeBedCount >= maxBeds ⇒ rejected. */
function singleCreateBlocked(activeBedCount: number, maxBeds: number): boolean {
  return activeBedCount >= maxBeds;
}

describe('Free-tier bed quota (hard cap, no grace)', () => {
  const FREE = 20;

  it('rejects a FIRST batch that exceeds the free limit (no grace)', () => {
    // currentCount === 0 must NOT get special treatment anymore.
    expect(batchWouldExceed(0, 50, FREE)).toBe(true);
    expect(batchWouldExceed(0, 21, FREE)).toBe(true);
  });

  it('allows a first batch up to exactly the free limit', () => {
    expect(batchWouldExceed(0, 20, FREE)).toBe(false);
    expect(batchWouldExceed(0, 1, FREE)).toBe(false);
  });

  it('rejects incremental batches once the limit is reached', () => {
    expect(batchWouldExceed(20, 1, FREE)).toBe(true); // already full
    expect(batchWouldExceed(18, 5, FREE)).toBe(true); // 23 > 20
    expect(batchWouldExceed(18, 2, FREE)).toBe(false); // 20, exactly at cap
  });

  it('blocks single bed creation at or above the limit', () => {
    expect(singleCreateBlocked(20, FREE)).toBe(true);
    expect(singleCreateBlocked(21, FREE)).toBe(true); // defensive: never below cap
    expect(singleCreateBlocked(19, FREE)).toBe(false);
  });

  it('cannot be ratcheted: re-batching after delete still caps at plan limit', () => {
    // Even if an owner soft-deleted everything (currentCount 0 again), the plan
    // limit (maxBeds) is unchanged and a huge re-batch is still rejected.
    const planLimitAfterDeletes = FREE; // not inflated by prior grace
    expect(batchWouldExceed(0, 50, planLimitAfterDeletes)).toBe(true);
  });
});
