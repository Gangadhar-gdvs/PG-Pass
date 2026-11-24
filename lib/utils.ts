import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { config } from './config';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isNaN(d.getTime())) return typeof value === 'string' ? value : '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function getCurrentMonthYear(): string {
  const d = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]}-${d.getFullYear()}`;
}

/**
 * Current billing period in canonical YYYY-MM form (e.g. "2026-11").
 * This is the `period` field actually stored on rent_records by the server
 * services; `getCurrentMonthYear()` returns the legacy "Nov-2026" display
 * string and must NOT be used for Firestore queries.
 */
export function getCurrentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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

export function getWhatsAppLink(phone: string, message: string): string {
  const cleaned = phone.replace(/\D/g, '');
  const withCountryCode = cleaned.startsWith('91') && cleaned.length > 10 ? cleaned : `91${cleaned.slice(-10)}`;
  return `https://wa.me/${withCountryCode}?text=${encodeURIComponent(message)}`;
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
