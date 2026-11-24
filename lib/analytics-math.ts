import { RentRecord } from '@/types';

export interface PeriodStat {
  period: string; // YYYY-MM
  label: string; // e.g. "Nov 26"
  duePaise: number;
  collectedPaise: number;
  collectionRate: number; // 0–100
  recordCount: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The last `n` period strings (YYYY-MM), oldest → newest, ending at `endPeriod`. */
export function recentPeriods(endPeriod: string, n: number): string[] {
  const [y, m] = endPeriod.split('-').map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

/**
 * Pure aggregation: group rent records into per-period collection stats for the
 * given ordered list of periods. Dependency-free and side-effect-free so it is
 * directly unit-testable.
 */
export function aggregateTrend(records: RentRecord[], periods: string[]): PeriodStat[] {
  const byPeriod = new Map<string, { due: number; collected: number; count: number }>();
  for (const p of periods) byPeriod.set(p, { due: 0, collected: 0, count: 0 });

  for (const r of records) {
    if (!r.period) continue;
    const bucket = byPeriod.get(r.period);
    if (!bucket) continue;
    bucket.due += r.amountDuePaise ?? 0;
    bucket.collected += r.amountPaidPaise ?? 0;
    bucket.count += 1;
  }

  return periods.map((p) => {
    const b = byPeriod.get(p)!;
    const [y, m] = p.split('-').map(Number);
    return {
      period: p,
      label: `${MONTHS[m - 1]} ${String(y).slice(-2)}`,
      duePaise: b.due,
      collectedPaise: b.collected,
      collectionRate: b.due > 0 ? Math.round((b.collected / b.due) * 100) : 0,
      recordCount: b.count,
    };
  });
}
