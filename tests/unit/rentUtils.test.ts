import { describe, it, expect } from 'vitest';
import { rentDueDate, validateUtr, formatDateIN } from '@/lib/utils';

describe('rentDueDate', () => {
  it('uses the configured due day', () => {
    expect(rentDueDate('2026-11', 10)).toBe('2026-11-10');
    expect(rentDueDate('2026-01', 1)).toBe('2026-01-01');
  });

  it('defaults to the 5th when no day is given', () => {
    expect(rentDueDate('2026-11')).toBe('2026-11-05');
  });

  it('clamps out-of-range days to 1–28', () => {
    expect(rentDueDate('2026-02', 31)).toBe('2026-02-28');
    expect(rentDueDate('2026-02', 0)).toBe('2026-02-01');
    expect(rentDueDate('2026-02', -4)).toBe('2026-02-01');
  });

  it('zero-pads single-digit days', () => {
    expect(rentDueDate('2026-11', 7)).toBe('2026-11-07');
  });
});

describe('validateUtr', () => {
  it('accepts a canonical 12-digit UTR', () => {
    const r = validateUtr('432198765432');
    expect(r.valid).toBe(true);
    expect(r.value).toBe('432198765432');
  });

  it('uppercases and trims alphanumeric references', () => {
    const r = validateUtr('  abc123def456  ');
    expect(r.valid).toBe(true);
    expect(r.value).toBe('ABC123DEF456');
  });

  it('rejects empty and too-short values', () => {
    expect(validateUtr('').valid).toBe(false);
    expect(validateUtr('12345').valid).toBe(false);
  });

  it('rejects values with disallowed characters', () => {
    expect(validateUtr('4321-9876-5432').valid).toBe(false);
  });
});

describe('formatDateIN', () => {
  it('formats ISO dates as DD/MM/YYYY', () => {
    expect(formatDateIN('2026-11-05')).toBe('05/11/2026');
  });

  it('returns empty string for nullish input', () => {
    expect(formatDateIN('')).toBe('');
    expect(formatDateIN(null)).toBe('');
    expect(formatDateIN(undefined)).toBe('');
  });

  it('echoes an unparseable string unchanged', () => {
    expect(formatDateIN('not-a-date')).toBe('not-a-date');
  });
});
