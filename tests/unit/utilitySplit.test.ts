import { describe, it, expect } from 'vitest';
import {
  computeSplit,
  daysInPeriod,
  distributeByWeights,
  meterUnits,
  occupancyDays,
  rupeesToPaise,
  rupeeText,
  utilityLineLabel,
  SplitError,
  type SplitResident,
} from '@/lib/utilitySplit';

/** Utility split maths — the money invariants the blueprint test matrix asks for. */

const P = '2026-11'; // 30 days

const r = (tenantId: string, tenantName: string, moveInDate = '2026-01-01', moveOutDate?: string): SplitResident => ({
  tenantId,
  tenantName,
  moveInDate,
  moveOutDate,
});

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof SplitError ? e.code : 'NOT_SPLIT_ERROR';
  }
  return undefined;
}

describe('period + occupancy days', () => {
  it('knows month lengths incl. leap years', () => {
    expect(daysInPeriod('2026-11')).toBe(30);
    expect(daysInPeriod('2026-12')).toBe(31);
    expect(daysInPeriod('2026-02')).toBe(28);
    expect(daysInPeriod('2028-02')).toBe(29);
    expect(codeOf(() => daysInPeriod('2026-13'))).toBe('INVALID_PERIOD');
  });

  it('counts move-in and move-out days inclusively, clamped to the month', () => {
    expect(occupancyDays(P, '2026-01-10')).toBe(30); // whole month
    expect(occupancyDays(P, '2026-11-16')).toBe(15); // mid-month move-in (16..30)
    expect(occupancyDays(P, '2026-10-01', '2026-11-10')).toBe(10); // mid-month move-out (1..10)
    expect(occupancyDays(P, '2026-11-05', '2026-11-05')).toBe(1); // same day
    expect(occupancyDays(P, '2026-11-30')).toBe(1); // last day
    expect(occupancyDays(P, '2026-12-01')).toBe(0); // moved in after the month
    expect(occupancyDays(P, '2026-01-01', '2026-10-31')).toBe(0); // left before it
    expect(occupancyDays('2028-02', '2028-02-15')).toBe(15); // leap Feb: 15..29
    expect(occupancyDays(P, null)).toBe(30); // unknown move-in → whole month
  });
});

describe('distributeByWeights (largest remainder, integer paise)', () => {
  it('hands remainder paise one-by-one so the total is exact', () => {
    const { shares, roundingPaise } = distributeByWeights(100, [1, 1, 1]);
    expect(shares).toEqual([34, 33, 33]);
    expect(roundingPaise).toEqual([1, 0, 0]);
  });

  it('gives remainder paise to the largest fractional parts first', () => {
    // 1000 × [3,3,1] / 7 = 428.57, 428.57, 142.86 → floors 428,428,142 (=998), 2 left
    // fractional remainders (×7): 4, 4, 6 → resident 3 first, then resident 1 (tie → earlier index)
    const { shares } = distributeByWeights(1000, [3, 3, 1]);
    expect(shares).toEqual([429, 428, 143]);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('always sums exactly and stays within 1 paisa of the exact share', () => {
    const weightSets = [[1], [1, 1], [30, 15, 10], [7, 11, 13, 17], [31, 1, 1, 1, 1, 1], [2, 3, 5, 7, 11, 13, 17, 19]];
    for (const weights of weightSets) {
      const W = weights.reduce((a, b) => a + b, 0);
      for (const total of [0, 1, 2, 3, 99, 100, 101, 12345, 99999, 1234567, 100_000_000]) {
        const { shares } = distributeByWeights(total, weights);
        expect(shares.reduce((a, b) => a + b, 0)).toBe(total);
        shares.forEach((s, i) => {
          expect(Number.isInteger(s)).toBe(true);
          // |s − total·w/W| < 1  ⇔  |s·W − total·w| < W
          expect(Math.abs(s * W - total * weights[i])).toBeLessThan(W);
        });
      }
    }
  });

  it('rejects negative / fractional amounts', () => {
    expect(codeOf(() => distributeByWeights(-1, [1]))).toBe('INVALID_AMOUNT');
    expect(codeOf(() => distributeByWeights(10.5, [1]))).toBe('INVALID_AMOUNT');
  });
});

describe('computeSplit', () => {
  const room = [r('t1', 'Asha'), r('t2', 'Bala'), r('t3', 'Chitra')];

  it('equal: splits across residents, remainder to the first by name', () => {
    const s = computeSplit({ period: P, totalPaise: 100_000, rule: 'equal', residents: room });
    expect(s.lines.map((l) => l.sharePaise)).toEqual([33_334, 33_333, 33_333]);
    expect(s.lines.map((l) => l.tenantName)).toEqual(['Asha', 'Bala', 'Chitra']);
    expect(s.lines[0].roundingPaise).toBe(1);
    expect(s.allocatedPaise).toBe(100_000);
  });

  it('equal: order is deterministic regardless of input order', () => {
    const a = computeSplit({ period: P, totalPaise: 1001, rule: 'equal', residents: room });
    const b = computeSplit({ period: P, totalPaise: 1001, rule: 'equal', residents: [...room].reverse() });
    expect(b.lines).toEqual(a.lines);
  });

  it('occupancy_days: pro-rates mid-month move-in and move-out', () => {
    const residents = [
      r('t1', 'Asha'), // 30 days
      r('t2', 'Bala', '2026-11-16'), // 15 days
      r('t3', 'Chitra', '2026-03-01', '2026-11-10'), // 10 days
    ];
    const s = computeSplit({ period: P, totalPaise: 5500_00, rule: 'occupancy_days', residents });
    expect(s.lines.map((l) => [l.tenantName, l.days, l.sharePaise])).toEqual([
      ['Asha', 30, 3000_00],
      ['Bala', 15, 1500_00],
      ['Chitra', 10, 1000_00],
    ]);
    expect(s.totalWeight).toBe(55);
    expect(s.allocatedPaise).toBe(5500_00);
  });

  it('occupancy_days: odd totals still allocate exactly (remainder distributed)', () => {
    const residents = [r('t1', 'Asha'), r('t2', 'Bala', '2026-11-16'), r('t3', 'Chitra', '2026-11-21')];
    const s = computeSplit({ period: P, totalPaise: 1_000_01, rule: 'occupancy_days', residents });
    expect(s.allocatedPaise).toBe(1_000_01);
    expect(s.lines.reduce((x, l) => x + l.roundingPaise, 0)).toBeLessThan(s.lines.length);
  });

  it('excludes residents who did not stay during the month', () => {
    const residents = [r('t1', 'Asha'), r('t9', 'Gone', '2026-01-01', '2026-10-15'), r('t8', 'Future', '2026-12-02')];
    const s = computeSplit({ period: P, totalPaise: 900, rule: 'equal', residents });
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]).toMatchObject({ tenantId: 't1', sharePaise: 900 });
    expect(s.excluded.map((e) => e.tenantId).sort()).toEqual(['t8', 't9']);
  });

  it('single resident pays the whole bill (any rule)', () => {
    for (const rule of ['equal', 'occupancy_days'] as const) {
      const s = computeSplit({ period: P, totalPaise: 2_345_67, rule, residents: [r('t1', 'Solo', '2026-11-20')] });
      expect(s.lines).toHaveLength(1);
      expect(s.lines[0].sharePaise).toBe(2_345_67);
    }
  });

  it('zero bill → zero charges for everyone (and is allowed with nobody in scope)', () => {
    const s = computeSplit({ period: P, totalPaise: 0, rule: 'equal', residents: room });
    expect(s.lines.every((l) => l.sharePaise === 0)).toBe(true);
    expect(s.allocatedPaise).toBe(0);
    expect(computeSplit({ period: P, totalPaise: 0, rule: 'occupancy_days', residents: [] }).lines).toEqual([]);
  });

  it('a non-zero bill with nobody in scope is rejected', () => {
    expect(codeOf(() => computeSplit({ period: P, totalPaise: 100, rule: 'equal', residents: [] }))).toBe('NO_RESIDENTS');
  });

  it('custom: amounts must sum EXACTLY to the bill', () => {
    const ok = computeSplit({
      period: P,
      totalPaise: 1000,
      rule: 'custom',
      residents: room,
      customPaise: { t1: 500, t2: 500 },
    });
    expect(ok.lines.map((l) => l.sharePaise)).toEqual([500, 500, 0]); // t3 omitted → ₹0
    expect(ok.allocatedPaise).toBe(1000);

    expect(
      codeOf(() => computeSplit({ period: P, totalPaise: 1000, rule: 'custom', residents: room, customPaise: { t1: 500, t2: 499 } }))
    ).toBe('CUSTOM_SUM_MISMATCH');
    expect(
      codeOf(() => computeSplit({ period: P, totalPaise: 1000, rule: 'custom', residents: room, customPaise: { t1: 1001 } }))
    ).toBe('CUSTOM_SUM_MISMATCH');
  });

  it('custom: rejects residents outside the scope and negative amounts', () => {
    expect(
      codeOf(() => computeSplit({ period: P, totalPaise: 10, rule: 'custom', residents: room, customPaise: { intruder: 10 } }))
    ).toBe('CUSTOM_UNKNOWN_RESIDENT');
    expect(
      codeOf(() => computeSplit({ period: P, totalPaise: 0, rule: 'custom', residents: room, customPaise: { t1: -5, t2: 5 } }))
    ).toBe('INVALID_AMOUNT');
  });

  it('rejects bills above the sanity ceiling', () => {
    expect(codeOf(() => computeSplit({ period: P, totalPaise: 100_000_001, rule: 'equal', residents: room }))).toBe(
      'INVALID_AMOUNT'
    );
  });
});

describe('meter readings', () => {
  it('computes units from previous → current', () => {
    expect(meterUnits({ previous: 1200, current: 1345.5 })).toBe(145.5);
    expect(meterUnits(null)).toBeNull();
  });

  it('rejects a current reading lower than the previous one', () => {
    expect(codeOf(() => meterUnits({ previous: 1500, current: 20 }))).toBe('METER_READING_LOWER');
  });

  it('allows a lower reading when the meter is flagged as reset (new meter from 0)', () => {
    expect(meterUnits({ previous: 1500, current: 20, reset: true })).toBe(20);
  });

  it('requires both readings', () => {
    expect(codeOf(() => meterUnits({ previous: 10 }))).toBe('METER_INCOMPLETE');
  });
});

describe('money parsing + labels', () => {
  it('parses rupee strings to paise without float drift', () => {
    expect(rupeesToPaise('1250')).toBe(125000);
    expect(rupeesToPaise('1250.5')).toBe(125050);
    expect(rupeesToPaise('1,250.75')).toBe(125075);
    expect(rupeesToPaise('0.07')).toBe(7);
    expect(rupeesToPaise('1.005')).toBeNull();
    expect(rupeesToPaise('-5')).toBeNull();
    expect(rupeesToPaise('abc')).toBeNull();
  });

  it('formats paise exactly', () => {
    expect(rupeeText(125050)).toBe('₹1,250.50');
    expect(rupeeText(100)).toBe('₹1');
    expect(rupeeText(-30000)).toBe('-₹300');
  });

  it('builds the rent line-item label', () => {
    expect(utilityLineLabel('electricity', 'room', '101', '2026-11')).toBe('Electricity · Room 101 · Nov 2026');
    expect(utilityLineLabel('water', 'property', null, '2026-02')).toBe('Water · Whole PG · Feb 2026');
  });
});
