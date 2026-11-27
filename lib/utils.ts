import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { config } from './config';
import type { Timestampish } from '@/types';
import { PLAN_TIER, type PlanTier } from '@/lib/constants/status';

/**
 * Convert a Firestore timestamp / Date / ISO string / epoch number to a `Date`,
 * or `null` if it can't be parsed. Centralises the `?.toDate?.()` dance so call
 * sites don't need `any` casts.
 */
export function tsToDate(v: Timestampish | null | undefined): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object' && typeof v.toDate === 'function') {
    try { return v.toDate(); } catch { return null; }
  }
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v === 'object' && typeof v.seconds === 'number') {
    return new Date(v.seconds * 1000);
  }
  return null;
}

/** Milliseconds since epoch for a timestamp-ish value, or 0 if unparseable. */
export function tsToMillis(v: Timestampish | null | undefined): number {
  const d = tsToDate(v);
  return d ? d.getTime() : 0;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely extract a human-readable message from an unknown thrown value.
 * Use in `catch (e: unknown)` blocks instead of `catch (e: any)` so error
 * handling stays type-safe while still surfacing the thrown message when present.
 */
export function errorMessage(e: unknown, fallback: string): string {
  // A browser `fetch` that never reached the server throws a TypeError with an
  // engine-specific message ("Failed to fetch", "Load failed", …) — not
  // something a resident or owner can act on (AGENTS §3).
  if (e instanceof TypeError && /failed to fetch|load failed|networkerror|network request failed/i.test(e.message)) {
    return "Couldn't reach PGPass. Check your internet connection and try again.";
  }
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'string' && e) return e;
  if (e && typeof e === 'object' && 'message' in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }
  return fallback;
}

export function generateToken(): string {
  // Cryptographically secure token generation
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  const length = config.security.tokenLength;
  
  if (typeof window !== 'undefined' && window.crypto) {
    const array = new Uint8Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array)
      .map((x) => chars[x % chars.length])
      .join('');
  }

  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Validate a UPI transaction reference (UTR / RRN). UPI UTRs are 12 digits;
 * some bank apps show a longer alphanumeric reference, so accept 12–22
 * alphanumerics but require at least the canonical 12-digit form to pass the
 * strict check. Returns the normalised (uppercased, trimmed) value.
 */
export function validateUtr(raw: string): { valid: boolean; value: string; error?: string } {
  const value = (raw || '').trim().toUpperCase();
  if (!value) return { valid: false, value, error: 'Enter the UPI reference / UTR number' };
  if (/^\d{12}$/.test(value)) return { valid: true, value };
  if (/^[A-Z0-9]{12,22}$/.test(value)) return { valid: true, value };
  return {
    valid: false,
    value,
    error: 'UTR should be the 12-digit reference from your UPI app',
  };
}

/** Format an ISO date (YYYY-MM-DD) or Date as DD/MM/YYYY for Indian users. */
export function formatDateIN(value?: string | Date | null): string {
  if (!value) return '';
  if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  }
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return typeof value === 'string' ? value : '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// ---------------------------------------------------------------------------
// India time (Asia/Kolkata). Business dates (rent periods, move-in/expense
// dates, "today") are IST calendar dates regardless of where the code runs:
// servers run in UTC and `toISOString()` is UTC, which is YESTERDAY between
// 00:00 and 05:30 IST (and last month on the 1st). India has no DST, so a fixed
// +05:30 offset is exact.
// ---------------------------------------------------------------------------

const IST_OFFSET_MS = 330 * 60_000;

/** Today's calendar date in Asia/Kolkata as YYYY-MM-DD. */
export function todayIST(now: Date | number = Date.now()): string {
  const ms = typeof now === 'number' ? now : now.getTime();
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** The current billing period (YYYY-MM) in Asia/Kolkata. */
export function currentPeriodIST(now: Date | number = Date.now()): string {
  return todayIST(now).slice(0, 7);
}

/** Add `days` to a YYYY-MM-DD calendar date (pure date arithmetic, no time zone). */
export function addDaysToIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Shift a YYYY-MM period by `delta` months (handles year rollover). */
export function shiftPeriodBy(period: string, delta: number): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function getCurrentMonthYear(): string {
  const [y, m] = currentPeriodIST().split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[m - 1]}-${y}`;
}

/**
 * Current billing period in canonical YYYY-MM form (e.g. "2026-11"), in IST.
 * This is the `period` field actually stored on rent_records by the server
 * services; `getCurrentMonthYear()` returns the legacy "Nov-2026" display
 * string and must NOT be used for Firestore queries.
 */
export function getCurrentPeriod(): string {
  return currentPeriodIST();
}

// ---------------------------------------------------------------------------
// API error messages. Every route returns errors as `{ error, code, requestId }`
// (withErrorHandler); a few legacy paths used `{ message }`. Clients must read
// these through apiErrorMessage/readApiError so the server's human-friendly
// message (e.g. "Incorrect PIN. 3 attempt(s) remaining.") reaches the user.
// ---------------------------------------------------------------------------

function humanizeApiError(msg: string, code?: string): string {
  if (code === 'VALIDATION_ERROR' || /^Validation failed:/i.test(msg)) {
    // "Validation failed: totalPaise: Amount cannot be negative; name: Too short"
    // → "Amount cannot be negative. Too short" (field paths are developer detail).
    const issues = msg
      .replace(/^Validation failed:\s*/i, '')
      .split(/;\s*/)
      .map((i) => i.replace(/^[\w.[\]-]+:\s+/, '').trim())
      .filter(Boolean);
    const unique = Array.from(new Set(issues));
    if (unique.length === 0) return 'Please check the details you entered and try again.';
    return unique.map((i) => i.charAt(0).toUpperCase() + i.slice(1).replace(/\.$/, '')).join('. ');
  }
  if (/missing session cookie|invalid or expired session/i.test(msg)) {
    return 'Your session has expired. Please sign in again.';
  }
  if (/^access denied: required role/i.test(msg)) {
    return "You don't have access to this. Please sign in with the right account.";
  }
  return msg;
}

/**
 * The user-facing message from an API error body: `error` → `message` →
 * `fallback`. Developer-only phrasing (validation field paths, session
 * internals) is rewritten into plain language.
 */
export function apiErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback;
  const b = body as { error?: unknown; message?: unknown; code?: unknown };
  const raw =
    typeof b.error === 'string' && b.error.trim()
      ? b.error.trim()
      : typeof b.message === 'string' && b.message.trim()
        ? b.message.trim()
        : '';
  if (!raw) return fallback;
  return humanizeApiError(raw, typeof b.code === 'string' ? b.code : undefined) || fallback;
}

/** Read a failed `Response`'s JSON body and return its user-facing message. */
export async function readApiError(res: Response, fallback: string): Promise<string> {
  const body = await res.json().catch(() => null);
  return apiErrorMessage(body, fallback);
}

/**
 * Compute the rent due date (YYYY-MM-DD) for a billing period given the PG's
 * configured day-of-month. Clamps to 1–28 so it is always a valid day in every
 * month. Defaults to the 5th when no day is configured.
 */
export function rentDueDate(period: string, dueDay?: number): string {
  // Note: use a null/undefined check, NOT `dueDay || 5` — a configured value of
  // 0 is falsy and must clamp to 1, not fall back to the default.
  const raw = dueDay === undefined || dueDay === null ? 5 : Math.floor(dueDay);
  const day = Math.min(28, Math.max(1, raw));
  return `${period}-${String(day).padStart(2, '0')}`;
}

/**
 * The last 10 digits of an Indian mobile number — the app's canonical phone key.
 * Strips spaces, `+91`, `0` prefixes, hyphens, etc. Returns `''` for empty input.
 * Use this EVERYWHERE instead of hand-rolling `str.replace(/\D/g,'').slice(-10)`
 * so tenant/owner/staff lookups all key on the same 10 digits.
 */
export function normalizePhone(raw: string | null | undefined): string {
  return (raw || '').replace(/\D/g, '').slice(-10);
}

/**
 * E.164-ish India number: `91` + the 10 canonical digits (no `+`). Returns `''`
 * when there aren't 10 digits to work with, so callers can guard before use.
 */
export function toIndiaMsisdn(raw: string | null | undefined): string {
  const ten = normalizePhone(raw);
  return ten.length === 10 ? `91${ten}` : '';
}

export function getWhatsAppLink(phone: string, message: string): string {
  const msisdn = toIndiaMsisdn(phone) || `91${normalizePhone(phone)}`;
  return `https://wa.me/${msisdn}?text=${encodeURIComponent(message)}`;
}

export function amountInWords(n: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  if (n === 0) return 'Zero';
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + amountInWords(n % 100) : '');
  if (n < 100000) return amountInWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + amountInWords(n % 1000) : '');
  return amountInWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + amountInWords(n % 100000) : '');
}

/**
 * Security deposit a resident has PAID, in rupees. The server stores money as
 * integer paise (`depositPaidPaise`); very old tenant docs may carry a rupee
 * `depositPaid` instead. Never read `depositPaid` directly in UI code.
 */
export function depositPaidRupees(
  t: { depositPaidPaise?: number | null; depositPaid?: number | null } | null | undefined
): number {
  if (!t) return 0;
  if (typeof t.depositPaidPaise === 'number' && Number.isFinite(t.depositPaidPaise)) {
    return Math.max(0, t.depositPaidPaise) / 100;
  }
  if (typeof t.depositPaid === 'number' && Number.isFinite(t.depositPaid)) {
    return Math.max(0, t.depositPaid);
  }
  return 0;
}

/**
 * The owner's subscription tier. The server writes `plan` (owner creation and
 * upgrade approval); `planTier` is accepted only as a legacy alias. Unknown or
 * missing values fall back to Free.
 */
export function ownerPlanTier(
  o: { plan?: string | null; planTier?: string | null } | null | undefined
): PlanTier {
  const raw = o?.plan ?? o?.planTier;
  const tiers = Object.values(PLAN_TIER) as string[];
  return raw && tiers.includes(raw) ? (raw as PlanTier) : PLAN_TIER.FREE;
}
