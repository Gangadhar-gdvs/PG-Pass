import { describe, it, expect } from 'vitest';
import { buildUpiPayload, buildWaReminderLink } from '@/lib/client/upi';

describe('Client UPI & WhatsApp Helpers', () => {
  it('should build a valid direct UPI deeplink', () => {
    const payload = buildUpiPayload({
      upiId: 'landlord@okaxis',
      merchantName: 'Skyline Luxury Coliving',
      amountPaise: 850000,
      transactionNote: 'Rent Apr 2026 Bed 101-A',
    });

    expect(payload).toContain('upi://pay?');
    expect(payload).toContain('pa=landlord%40okaxis');
    expect(payload).toContain('pn=Skyline+Luxury+Coliving');
    expect(payload).toContain('am=8500.00');
    expect(payload).toContain('cu=INR');
  });

  it('should build a valid WhatsApp wa.me reminder link', () => {
    const phone = '+91 98765-43210';
    const message = 'Namaste ji 🙏 Rent is due';
    const link = buildWaReminderLink(phone, message);

    expect(link.startsWith('https://wa.me/919876543210')).toBe(true);
    expect(link).toContain(encodeURIComponent(message));
  });
});
