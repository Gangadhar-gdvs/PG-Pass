import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  todayIST,
  currentPeriodIST,
  getCurrentPeriod,
  addDaysToIsoDate,
  shiftPeriodBy,
  apiErrorMessage,
  readApiError,
  formatDateIN,
} from '@/lib/utils';

/**
 * R-A5 / R-A6: business dates are Asia/Kolkata calendar dates. IST is UTC+05:30,
 * so the IST day flips at 18:30 UTC — before that `toISOString()` (UTC) still
 * says yesterday / last month / last year.
 */
describe('IST today / period around the 18:30 UTC boundary', () => {
  afterEach(() => vi.useRealTimers());

  it('is still the same IST day just before 18:30 UTC, the next day from 18:30', () => {
    expect(todayIST(Date.UTC(2026, 10, 27, 18, 29, 59))).toBe('2026-11-27');
    expect(todayIST(Date.UTC(2026, 10, 27, 18, 30, 0))).toBe('2026-11-28');
    // 00:00–05:30 IST on the 28th is still the 27th in UTC.
    expect(new Date(Date.UTC(2026, 10, 27, 20, 0)).toISOString().slice(0, 10)).toBe('2026-11-27');
    expect(todayIST(new Date(Date.UTC(2026, 10, 27, 20, 0)))).toBe('2026-11-28');
  });

  it('rolls the period over at month end (00:15 IST on the 1st)', () => {
    const at = Date.UTC(2026, 10, 30, 18, 45); // 1 Dec 2026, 00:15 IST
    expect(new Date(at).toISOString().slice(0, 7)).toBe('2026-11'); // the old UTC bug
    expect(todayIST(at)).toBe('2026-12-01');
    expect(currentPeriodIST(at)).toBe('2026-12');
  });

  it('rolls the period and year over on 1 January', () => {
    const at = Date.UTC(2026, 11, 31, 19, 0); // 1 Jan 2027, 00:30 IST
    expect(currentPeriodIST(at)).toBe('2027-01');
    expect(todayIST(at)).toBe('2027-01-01');
    expect(currentPeriodIST(Date.UTC(2026, 11, 31, 18, 29))).toBe('2026-12');
  });

  it('getCurrentPeriod() follows IST regardless of the runtime time zone', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 11, 31, 19, 0)));
    expect(getCurrentPeriod()).toBe('2027-01');
  });

  it('handles leap days', () => {
    expect(todayIST(Date.UTC(2028, 1, 28, 18, 30))).toBe('2028-02-29');
    expect(todayIST(Date.UTC(2028, 1, 29, 18, 30))).toBe('2028-03-01');
  });
});

describe('calendar arithmetic helpers', () => {
  it('adds days across month/year ends', () => {
    expect(addDaysToIsoDate('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDaysToIsoDate('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToIsoDate('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('shifts periods without the Jan-31 setMonth overflow', () => {
    expect(shiftPeriodBy('2026-01', 1)).toBe('2026-02');
    expect(shiftPeriodBy('2026-12', 1)).toBe('2027-01');
    expect(shiftPeriodBy('2027-01', -1)).toBe('2026-12');
    // The old cron did `d.setMonth(d.getMonth() + 1)` on 31 Jan → 3 March.
    const d = new Date(Date.UTC(2026, 0, 31));
    d.setUTCMonth(d.getUTCMonth() + 1);
    expect(d.toISOString().slice(0, 7)).toBe('2026-03');
  });

  it('formats a stored YYYY-MM-DD without a time-zone shift', () => {
    expect(formatDateIN('2026-12-01')).toBe('01/12/2026');
  });
});

describe('apiErrorMessage (R-A3)', () => {
  it('prefers `error` (withErrorHandler shape), then legacy `message`, then the fallback', () => {
    expect(apiErrorMessage({ error: 'Incorrect PIN. 3 attempt(s) remaining.', code: undefined, requestId: 'r' }, 'x')).toBe(
      'Incorrect PIN. 3 attempt(s) remaining.'
    );
    expect(apiErrorMessage({ message: 'Legacy message' }, 'x')).toBe('Legacy message');
    expect(apiErrorMessage({ error: 'A', message: 'B' }, 'x')).toBe('A');
    expect(apiErrorMessage({ error: '   ' }, 'Fallback')).toBe('Fallback');
    expect(apiErrorMessage({}, 'Fallback')).toBe('Fallback');
    expect(apiErrorMessage(null, 'Fallback')).toBe('Fallback');
    expect(apiErrorMessage('oops', 'Fallback')).toBe('Fallback');
    expect(apiErrorMessage({ error: 42 }, 'Fallback')).toBe('Fallback');
  });

  it('keeps portal lockout / expiry messages verbatim', () => {
    expect(apiErrorMessage({ error: 'Too many failed attempts. Account locked for 15 minutes.' }, 'x')).toBe(
      'Too many failed attempts. Account locked for 15 minutes.'
    );
    expect(apiErrorMessage({ error: 'Portal link not found or has expired' }, 'x')).toBe('Portal link not found or has expired');
  });

  it('strips validation field paths (developer detail)', () => {
    expect(
      apiErrorMessage(
        { error: 'Validation failed: totalPaise: Amount cannot be negative; name: Name must be at least 2 characters', code: 'VALIDATION_ERROR' },
        'x'
      )
    ).toBe('Amount cannot be negative. Name must be at least 2 characters');
    expect(apiErrorMessage({ error: 'phone: Must be a valid 10-digit Indian mobile number', code: 'VALIDATION_ERROR' }, 'x')).toBe(
      'Must be a valid 10-digit Indian mobile number'
    );
  });

  it('rewrites session internals into plain language', () => {
    expect(apiErrorMessage({ error: 'Authentication required: missing session cookie' }, 'x')).toBe(
      'Your session has expired. Please sign in again.'
    );
    expect(apiErrorMessage({ error: 'Access denied: required role owner' }, 'x')).toMatch(/don't have access/);
  });

  it('readApiError tolerates non-JSON bodies', async () => {
    expect(await readApiError(new Response('<html>502</html>', { status: 502 }), 'Server unavailable')).toBe('Server unavailable');
    expect(
      await readApiError(new Response(JSON.stringify({ error: 'Rent record for 2026-11 already exists' }), { status: 409 }), 'x')
    ).toBe('Rent record for 2026-11 already exists');
  });
});

describe('errorMessage network errors', () => {
  it('turns a browser fetch failure into an actionable message', async () => {
    const { errorMessage } = await import('@/lib/utils');
    expect(errorMessage(new TypeError('Failed to fetch'), 'x')).toMatch(/internet connection/);
    expect(errorMessage(new TypeError('Load failed'), 'x')).toMatch(/internet connection/);
    expect(errorMessage(new Error('Rent record not found'), 'x')).toBe('Rent record not found');
    expect(errorMessage(undefined, 'Fallback')).toBe('Fallback');
  });
});
