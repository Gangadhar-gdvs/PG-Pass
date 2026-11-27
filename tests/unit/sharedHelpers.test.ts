import { describe, it, expect } from 'vitest';
import { normalizePhone, toIndiaMsisdn, getWhatsAppLink } from '@/lib/utils';
import { statusMeta } from '@/lib/statusMeta';

describe('normalizePhone — single source of truth for phone keys', () => {
  it('strips +91 / spaces / hyphens to the last 10 digits', () => {
    expect(normalizePhone('+91 98765-43210')).toBe('9876543210');
    expect(normalizePhone('09876543210')).toBe('9876543210');
    expect(normalizePhone('919876543210')).toBe('9876543210');
  });

  it('returns empty string for empty / nullish input', () => {
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone(null)).toBe('');
    expect(normalizePhone(undefined)).toBe('');
  });

  it('toIndiaMsisdn prefixes 91 only when 10 digits exist', () => {
    expect(toIndiaMsisdn('98765 43210')).toBe('919876543210');
    expect(toIndiaMsisdn('12345')).toBe(''); // not enough digits → caller guards
  });

  it('getWhatsAppLink builds a wa.me link on the normalized number', () => {
    expect(getWhatsAppLink('+91 98765 43210', 'hi')).toBe('https://wa.me/919876543210?text=hi');
  });
});

describe('statusMeta — single source of truth for status badges', () => {
  it('maps known rent statuses to the right variant + label', () => {
    expect(statusMeta('rent', 'paid')).toEqual({ variant: 'paid', label: 'Paid' });
    expect(statusMeta('rent', 'verify')).toEqual({ variant: 'verify', label: 'Under Verification' });
    expect(statusMeta('rent', 'pending')).toEqual({ variant: 'pending', label: 'Payment Due' });
  });

  it('maps maintenance + bed + account domains', () => {
    // 'open' is a calm pending-amber (matches the established maintenance design),
    // not an alarming red — see lib/statusMeta.ts.
    expect(statusMeta('maintenance', 'open').variant).toBe('pending');
    expect(statusMeta('maintenance', 'in_progress').variant).toBe('verify');
    expect(statusMeta('bed', 'vacant').variant).toBe('vacant');
    expect(statusMeta('account', 'suspended').variant).toBe('danger');
  });

  it('degrades an unknown status to a neutral title-cased badge (never throws)', () => {
    expect(statusMeta('rent', 'some_new_state')).toEqual({ variant: 'neutral', label: 'Some New State' });
    expect(statusMeta('rent', null)).toEqual({ variant: 'neutral', label: '—' });
  });
});
