import { describe, it, expect } from 'vitest';
import {
  ownerProfileSchema,
  createBedSchema,
  createTenantSchema,
  createRentRecordSchema,
} from '@/lib/validation';

describe('Validation Schemas', () => {
  describe('ownerProfileSchema', () => {
    it('accepts valid owner profile', () => {
      const valid = {
        name: 'Ramesh Kumar',
        phone: '9876543210',
        pgName: 'Sri Krishna PG',
        address: '123 Koramangala, Bangalore',
        upiId: 'ramesh@icici',
        panNumber: 'ABCDE1234F',
      };
      const result = ownerProfileSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects invalid UPI ID', () => {
      const invalid = {
        name: 'Ramesh Kumar',
        phone: '9876543210',
        pgName: 'Sri Krishna PG',
        address: '123 Koramangala, Bangalore',
        upiId: 'not-a-valid-upi',
      };
      const result = ownerProfileSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('rejects invalid Indian mobile number', () => {
      const invalid = {
        name: 'Ramesh Kumar',
        phone: '1234567890', // Must start with 6-9
        pgName: 'Sri Krishna PG',
        address: '123 Koramangala, Bangalore',
        upiId: 'ramesh@upi',
      };
      const result = ownerProfileSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('createBedSchema', () => {
    it('accepts valid bed creation payload', () => {
      const valid = {
        roomNumber: '101',
        bedLabel: '101-A',
        rentAmountPaise: 850000,
        floor: 1,
      };
      const result = createBedSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects negative or fractional rent amount', () => {
      const invalid = {
        roomNumber: '101',
        bedLabel: '101-A',
        rentAmountPaise: -500,
        floor: 1,
      };
      expect(createBedSchema.safeParse(invalid).success).toBe(false);

      const invalidFloat = {
        roomNumber: '101',
        bedLabel: '101-A',
        rentAmountPaise: 8500.5,
        floor: 1,
      };
      expect(createBedSchema.safeParse(invalidFloat).success).toBe(false);
    });
  });

  describe('createTenantSchema', () => {
    it('accepts valid tenant onboarding data', () => {
      const valid = {
        bedId: 'bed_123',
        name: 'Rahul Sharma',
        phone: '9876543210',
        securityDepositPaise: 1000000,
        depositPaidPaise: 1000000,
        moveInDate: '2026-04-01',
      };
      const result = createTenantSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.idProofType).toBe('aadhaar');
      }
    });

    it('rejects short tenant names', () => {
      const invalid = {
        bedId: 'bed_123',
        name: 'R',
        phone: '9876543210',
        securityDepositPaise: 1000000,
        moveInDate: '2026-04-01',
      };
      expect(createTenantSchema.safeParse(invalid).success).toBe(false);
    });
  });

  describe('createRentRecordSchema', () => {
    it('accepts valid rent record payload with period and line items', () => {
      const valid = {
        tenantId: 'tenant_abc',
        period: '2026-04',
        lineItems: [{ label: 'Monthly Room Rent', amountPaise: 850000 }],
        dueDate: '2026-04-05',
      };
      const result = createRentRecordSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects invalid period format', () => {
      const invalid = {
        tenantId: 'tenant_abc',
        period: 'Apr 2026', // must be YYYY-MM
        lineItems: [{ label: 'Monthly Room Rent', amountPaise: 850000 }],
        dueDate: '2026-04-05',
      };
      expect(createRentRecordSchema.safeParse(invalid).success).toBe(false);
    });
  });
});
