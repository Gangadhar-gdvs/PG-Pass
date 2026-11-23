import { describe, it, expect } from 'vitest';
import { redactValue, sanitizeObject } from '@/lib/server/monitoring/logger';

describe('PII Masking & Log Sanitization (DPDP Compliance)', () => {
  it('masks Indian phone numbers showing only last 4 digits', () => {
    expect(redactValue('phone', '9876543210')).toBe('******3210');
    expect(redactValue('contactPhone', '+919876543210')).toBe('********3210');
    expect(redactValue('phone', '123')).toBe('***');
  });

  it('redacts sensitive credentials and tokens in logs', () => {
    const raw = {
      user: 'tenant_1',
      phone: '9876543210',
      token: 'secret_token_abc123',
      apiKey: 'key_xyz',
      password: 'super_secret_password',
      creditCard: '1234-5678-9012-3456',
      normalField: 'all good',
    };

    const sanitized = sanitizeObject(raw);

    expect(sanitized.phone).toBe('******3210');
    expect(sanitized.token).toBe('[REDACTED]');
    expect(sanitized.apiKey).toBe('[REDACTED]');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.creditCard).toBe('[REDACTED]');
    expect(sanitized.normalField).toBe('all good');
  });

  it('recursively sanitizes nested objects', () => {
    const nested = {
      meta: {
        pin: '1234',
        details: {
          clientPhone: '9988776655',
        },
      },
    };

    const sanitized = sanitizeObject(nested) as any;
    expect(sanitized.meta.pin).toBe('[REDACTED]');
    expect(sanitized.meta.details.clientPhone).toBe('******6655');
  });
});
