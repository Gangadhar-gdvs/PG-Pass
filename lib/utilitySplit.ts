/**
 * Utility bill split: pure, deterministic, integer-paise maths.
 *
 * Shared by the server (utilities.service) and the owner UI (labels, rupee
 * parsing). No Firestore, no clock, no floats in money.
 *
 * ROUNDING (documented per blueprint §Money):
 *   Each resident's exact share is `total × weight / Σweight`. Everyone first
 *   gets the FLOOR of that in paise. The leftover paise (always fewer than the
 *   number of residents) are then handed out ONE PAISA EACH, to the residents
 *   with the largest fractional remainder; ties go to the earlier resident in
 *   the sorted order (name, then tenantId). The allocated total therefore
 *   EXACTLY equals the bill, with nobody more than 1 paisa off their exact share.
 *
 * OCCUPANCY DAYS: calendar days inside the billing month on which the resident
 * stayed, counting BOTH the move-in day and the move-out day. A resident with
 * no (or an unparseable) move-in date is treated as present from the 1st.
 */
import type { UtilityAllocationRule, UtilityScope, UtilityType } from '@/types';

export const UTILITY_TYPES = ['electricity', 'water', 'gas', 'internet', 'other'] as const;
export const UTILITY_ALLOCATION_RULES = ['equal', 'occupancy_days', 'custom'] as const;
export const UTILITY_SCOPES = ['room', 'property'] as const;

export const UTILITY_TYPE_LABELS: Record<UtilityType, string> = {
  electricity: 'Electricity',
  water: 'Water',
  gas: 'Gas',
  internet: 'Internet',
  other: 'Utility',
};

export const UTILITY_RULE_LABELS: Record<UtilityAllocationRule, string> = {
  equal: 'Equal split',
  occupancy_days: 'By days stayed',
  custom: 'Custom amounts',
};

/** ₹10,00,000 — a sanity ceiling that also keeps `total × weight` a safe integer. */
export const MAX_UTILITY_BILL_PAISE = 100_000_000;
/** One bill fans out to at most this many rent records (one transaction). */
export const MAX_UTILITY_ALLOCATIONS = 100;

export type SplitErrorCode =
  | 'INVALID_PERIOD'
  | 'INVALID_AMOUNT'
  | 'NO_RESIDENTS'
  | 'TOO_MANY_RESIDENTS'
  | 'CUSTOM_SUM_MISMATCH'
  | 'CUSTOM_UNKNOWN_RESIDENT'
  | 'METER_INCOMPLETE'
  | 'METER_READING_LOWER';

/** A business-rule failure with a message that is safe to show the owner. */
export class SplitError extends Error {
  constructor(
    public code: SplitErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'SplitError';
  }
}

const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function isValidPeriod(period: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(period);
}

/** True for a real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function dayIndex(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/** Number of days in a YYYY-MM billing period (leap-year aware). */
export function daysInPeriod(period: string): number {
  if (!isValidPeriod(period)) throw new SplitError('INVALID_PERIOD', 'Billing month must be in YYYY-MM format');
  const [y, m] = period.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** "2026-11" → "Nov 2026". */
export function formatPeriodLabel(period: string): string {
  if (!isValidPeriod(period)) return period;
  const [y, m] = period.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Shift a YYYY-MM period by `delta` months. */
export function shiftPeriod(period: string, delta: number): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Days the resident stayed inside the period (move-in and move-out day both
 * count). 0 when they moved in after the month or left before it.
 */
export function occupancyDays(period: string, moveInDate?: string | null, moveOutDate?: string | null): number {
  const days = daysInPeriod(period);
  const start = dayIndex(`${period}-01`);
  const end = start + days - 1;
  const from = moveInDate && isValidIsoDate(moveInDate) ? Math.max(start, dayIndex(moveInDate)) : start;
  const to = moveOutDate && isValidIsoDate(moveOutDate) ? Math.min(end, dayIndex(moveOutDate)) : end;
  return to >= from ? to - from + 1 : 0;
}

/**
 * Split `totalPaise` in proportion to integer `weights` (largest-remainder
 * method, see the header comment). Returns each share and whether that share
 * received a +1 rounding paisa. Σshares === totalPaise, always.
 */
export function distributeByWeights(
  totalPaise: number,
  weights: number[]
): { shares: number[]; roundingPaise: number[] } {
  if (!Number.isSafeInteger(totalPaise) || totalPaise < 0) {
    throw new SplitError('INVALID_AMOUNT', 'Bill amount must be a whole number of paise (0 or more)');
  }
  if (weights.some((w) => !Number.isSafeInteger(w) || w < 0)) {
    throw new SplitError('INVALID_AMOUNT', 'Split weights must be whole numbers (0 or more)');
  }
  const zeros = weights.map(() => 0);
  if (totalPaise === 0) return { shares: zeros, roundingPaise: [...zeros] };

  const totalWeight = weights.reduce((s, w) => s + w, 0);
  if (totalWeight === 0) {
    throw new SplitError('NO_RESIDENTS', 'There is nobody to split this bill between');
  }
  const maxWeight = Math.max(...weights);
  if (!Number.isSafeInteger(totalPaise * maxWeight)) {
    throw new SplitError('INVALID_AMOUNT', 'Bill amount is too large to split');
  }

  // Exact integer floor + remainder (no float division of money).
  const remainders = weights.map((w) => (totalPaise * w) % totalWeight);
  const shares = weights.map((w, i) => (totalPaise * w - remainders[i]) / totalWeight);
  const roundingPaise = [...zeros];

  let leftover = totalPaise - shares.reduce((s, v) => s + v, 0);
  const order = weights
    .map((_, i) => i)
    .sort((a, b) => remainders[b] - remainders[a] || a - b);
  for (const i of order) {
    if (leftover <= 0) break;
    shares[i] += 1;
    roundingPaise[i] = 1;
    leftover -= 1;
  }
  return { shares, roundingPaise };
}

export interface SplitResident {
  tenantId: string;
  tenantName?: string;
  bedLabel?: string | null;
  moveInDate?: string | null;
  moveOutDate?: string | null;
}

export interface SplitLine {
  tenantId: string;
  tenantName: string;
  bedLabel: string | null;
  /** Days stayed in the period. */
  days: number;
  /** equal: 1 · occupancy_days: days · custom: the amount itself. */
  weight: number;
  sharePaise: number;
  /** 1 when this resident absorbed a remainder paisa, else 0. */
  roundingPaise: number;
}

export interface SplitResult {
  rule: UtilityAllocationRule;
  totalPaise: number;
  daysInPeriod: number;
  totalWeight: number;
  lines: SplitLine[];
  allocatedPaise: number;
  /** Residents linked to the scope who did not stay during the period. */
  excluded: Array<{ tenantId: string; tenantName: string; reason: string }>;
}

export interface SplitInput {
  period: string;
  totalPaise: number;
  rule: UtilityAllocationRule;
  residents: SplitResident[];
  /** custom rule only: tenantId → paise. Missing residents get ₹0. */
  customPaise?: Record<string, number> | null;
}

/** Compute the full, transparent allocation for a utility bill. */
export function computeSplit(input: SplitInput): SplitResult {
  const { period, totalPaise, rule } = input;
  const monthDays = daysInPeriod(period);
  if (!Number.isSafeInteger(totalPaise) || totalPaise < 0 || totalPaise > MAX_UTILITY_BILL_PAISE) {
    throw new SplitError('INVALID_AMOUNT', 'Enter a bill amount between ₹0 and ₹10,00,000');
  }

  // De-duplicate and attach occupancy days.
  const seen = new Set<string>();
  const withDays = input.residents
    .filter((r) => r.tenantId && !seen.has(r.tenantId) && seen.add(r.tenantId))
    .map((r) => ({
      tenantId: r.tenantId,
      tenantName: (r.tenantName || 'Resident').trim() || 'Resident',
      bedLabel: r.bedLabel ?? null,
      days: occupancyDays(period, r.moveInDate, r.moveOutDate),
    }));

  const eligible = withDays
    .filter((r) => r.days > 0)
    .sort((a, b) => a.tenantName.localeCompare(b.tenantName) || (a.tenantId < b.tenantId ? -1 : a.tenantId > b.tenantId ? 1 : 0));
  const excluded = withDays
    .filter((r) => r.days === 0)
    .map((r) => ({
      tenantId: r.tenantId,
      tenantName: r.tenantName,
      reason: `Did not stay during ${formatPeriodLabel(period)}`,
    }));

  if (eligible.length > MAX_UTILITY_ALLOCATIONS) {
    throw new SplitError(
      'TOO_MANY_RESIDENTS',
      `One bill can be split across at most ${MAX_UTILITY_ALLOCATIONS} residents. Record it per room instead.`
    );
  }
  if (eligible.length === 0 && totalPaise > 0) {
    throw new SplitError(
      'NO_RESIDENTS',
      `Nobody stayed here during ${formatPeriodLabel(period)}, so there is no one to split this bill with.`
    );
  }

  let lines: SplitLine[];
  if (rule === 'custom') {
    const custom = input.customPaise || {};
    const eligibleIds = new Set(eligible.map((r) => r.tenantId));
    for (const [tenantId, paise] of Object.entries(custom)) {
      if (!eligibleIds.has(tenantId)) {
        const ex = excluded.find((e) => e.tenantId === tenantId);
        throw new SplitError(
          'CUSTOM_UNKNOWN_RESIDENT',
          ex
            ? `${ex.tenantName} did not stay during ${formatPeriodLabel(period)} and can't be charged`
            : 'A custom amount was entered for someone who is not a resident here'
        );
      }
      if (!Number.isSafeInteger(paise) || paise < 0) {
        throw new SplitError('INVALID_AMOUNT', 'Custom amounts must be ₹0 or more');
      }
    }
    lines = eligible.map((r) => {
      const share = custom[r.tenantId] ?? 0;
      return { ...r, weight: share, sharePaise: share, roundingPaise: 0 };
    });
    const sum = lines.reduce((s, l) => s + l.sharePaise, 0);
    if (sum !== totalPaise) {
      const diff = totalPaise - sum;
      throw new SplitError(
        'CUSTOM_SUM_MISMATCH',
        diff > 0
          ? `Custom amounts are ${rupeeText(diff)} short of the bill total. They must add up exactly.`
          : `Custom amounts are ${rupeeText(-diff)} more than the bill total. They must add up exactly.`
      );
    }
  } else {
    const weights = eligible.map((r) => (rule === 'occupancy_days' ? r.days : 1));
    const { shares, roundingPaise } = distributeByWeights(totalPaise, weights);
    lines = eligible.map((r, i) => ({
      ...r,
      weight: weights[i],
      sharePaise: shares[i],
      roundingPaise: roundingPaise[i],
    }));
  }

  const allocatedPaise = lines.reduce((s, l) => s + l.sharePaise, 0);
  if (allocatedPaise !== totalPaise) {
    // Unreachable by construction — guard the money invariant loudly anyway.
    throw new Error(`Utility split invariant broken: ${allocatedPaise} !== ${totalPaise}`);
  }

  return {
    rule,
    totalPaise,
    daysInPeriod: monthDays,
    totalWeight: lines.reduce((s, l) => s + l.weight, 0),
    lines,
    allocatedPaise,
    excluded,
  };
}

export interface MeterInput {
  previous: number;
  current: number;
  reset?: boolean;
}

/**
 * Units consumed from two meter readings (rounded to 2 decimals). A current
 * reading lower than the previous one is rejected unless the owner flags the
 * meter as reset/replaced, in which case the new meter is assumed to have
 * started from zero (units = current reading).
 */
export function meterUnits(meter?: Partial<MeterInput> | null): number | null {
  if (!meter) return null;
  const hasPrev = typeof meter.previous === 'number';
  const hasCur = typeof meter.current === 'number';
  if (!hasPrev && !hasCur) return null;
  if (!hasPrev || !hasCur) {
    throw new SplitError('METER_INCOMPLETE', 'Enter both the previous and the current meter reading');
  }
  const prev = meter.previous as number;
  const cur = meter.current as number;
  if (!Number.isFinite(prev) || !Number.isFinite(cur) || prev < 0 || cur < 0) {
    throw new SplitError('METER_INCOMPLETE', 'Meter readings must be 0 or more');
  }
  if (cur < prev) {
    if (!meter.reset) {
      throw new SplitError(
        'METER_READING_LOWER',
        'Current reading is lower than the previous one. If the meter was reset or replaced, tick "Meter was reset".'
      );
    }
    return Math.round(cur * 100) / 100;
  }
  return Math.round((cur - prev) * 100) / 100;
}

/**
 * Parse a rupee string ("1250", "1250.5", "1,250.75") into integer paise
 * without float maths. Returns null when it isn't a valid amount.
 */
export function rupeesToPaise(input: string): number | null {
  const s = (input || '').replace(/[,\s₹]/g, '');
  const m = /^(\d{1,9})(?:\.(\d{0,2}))?$/.exec(s);
  if (!m) return null;
  const rupees = Number(m[1]);
  const fraction = (m[2] || '').padEnd(2, '0');
  return rupees * 100 + Number(fraction || '0');
}

/** "₹1,234.50" — paise to an exact rupee string (2 decimals only when needed). */
export function rupeeText(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(paise));
  const rupees = Math.floor(abs / 100);
  const p = abs % 100;
  const whole = new Intl.NumberFormat('en-IN').format(rupees);
  return `${sign}₹${whole}${p ? `.${String(p).padStart(2, '0')}` : ''}`;
}

/** Rent line-item label, e.g. "Electricity · Room 101 · Nov 2026". */
export function utilityLineLabel(
  type: UtilityType,
  scope: UtilityScope,
  roomNumber: string | null | undefined,
  period: string
): string {
  const where = scope === 'room' && roomNumber ? `Room ${roomNumber}` : 'Whole PG';
  return `${UTILITY_TYPE_LABELS[type] || 'Utility'} · ${where} · ${formatPeriodLabel(period)}`;
}
