import { describe, it, expect } from 'vitest';
import { recentPeriods, aggregateTrend } from '@/lib/analytics-math';
import type { RentRecord } from '@/types';

describe('recentPeriods', () => {
  it('returns n periods oldest → newest ending at the given period', () => {
    expect(recentPeriods('2026-03', 3)).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('wraps across year boundaries', () => {
    expect(recentPeriods('2026-01', 3)).toEqual(['2025-11', '2025-12', '2026-01']);
  });

  it('zero-pads months', () => {
    expect(recentPeriods('2026-10', 2)).toEqual(['2026-09', '2026-10']);
  });
});

describe('aggregateTrend', () => {
  const rec = (period: string, due: number, paid: number): RentRecord =>
    ({ id: `${period}`, ownerId: 'o', tenantId: 't', status: 'pending', period, amountDuePaise: due, amountPaidPaise: paid } as RentRecord);

  it('buckets records by period and computes collection rate', () => {
    const records = [
      rec('2026-01', 10000, 10000),
      rec('2026-02', 10000, 5000),
      rec('2026-02', 10000, 0),
    ];
    const out = aggregateTrend(records, ['2026-01', '2026-02']);
    expect(out[0].collectionRate).toBe(100);
    expect(out[1].duePaise).toBe(20000);
    expect(out[1].collectedPaise).toBe(5000);
    expect(out[1].collectionRate).toBe(25);
    expect(out[1].recordCount).toBe(2);
  });

  it('ignores records outside the requested periods', () => {
    const out = aggregateTrend([rec('2025-12', 10000, 10000)], ['2026-01']);
    expect(out[0].recordCount).toBe(0);
    expect(out[0].duePaise).toBe(0);
  });

  it('reports 0% (not NaN) when nothing is due', () => {
    const out = aggregateTrend([], ['2026-01']);
    expect(out[0].collectionRate).toBe(0);
  });

  it('produces a short month-year label', () => {
    const out = aggregateTrend([], ['2026-11']);
    expect(out[0].label).toBe('Nov 26');
  });

  // Guards the analytics service's `const current = trend[trend.length - 1]`:
  // the trend must always be a full, defined row even for a brand-new owner with
  // no rent records, so reading current.collectionRate never throws (which would
  // surface as the "Couldn't load analytics" 500).
  it('always returns a defined current row for a 6-month window with no records', () => {
    const periods = recentPeriods('2026-11', 6);
    expect(periods).toHaveLength(6);
    const trend = aggregateTrend([], periods);
    expect(trend).toHaveLength(6);
    const current = trend[trend.length - 1];
    expect(current).toBeDefined();
    expect(current.collectionRate).toBe(0);
    expect(current.collectedPaise).toBe(0);
    expect(current.duePaise).toBe(0);
  });
});
