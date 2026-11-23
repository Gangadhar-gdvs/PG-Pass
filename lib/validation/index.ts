import { z } from 'zod';
import { BED_STATUS, PHOTO_TYPE, PLAN_TIER } from '@/lib/constants/status';

// Owner onboarding and update schema
export const ownerProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian phone number'),
  pgName: z.string().min(2, 'PG Name must be at least 2 characters'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  upiId: z.string().regex(/^[\w.-]+@[\w.-]+$/, 'Invalid UPI ID format (e.g. name@bank)'),
  upiMerchantName: z.string().optional(),
  panNumber: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format').optional().or(z.literal('')),
});

// Bed creation and update schema
export const createBedSchema = z.object({
  roomNumber: z.string().min(1, 'Room number required'),
  bedLabel: z.string().min(1, 'Bed label required'),
  rentAmountPaise: z.number().int().positive('Rent must be a positive integer in paise'),
  floor: z.number().int().min(0).default(1),
});

export const updateBedSchema = z.object({
  roomNumber: z.string().optional(),
  bedLabel: z.string().optional(),
  rentAmountPaise: z.number().int().positive().optional(),
  status: z.enum([BED_STATUS.VACANT, BED_STATUS.OCCUPIED, BED_STATUS.MAINTENANCE]).optional(),
});

// Tenant onboarding schema (with atomic bed assignment)
export const createTenantSchema = z.object({
  bedId: z.string().min(1, 'Please select a bed'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number'),
  idProofType: z.string().default('aadhaar'),
  securityDepositPaise: z.number().int().min(0, 'Deposit must be 0 or positive paise'),
  depositPaidPaise: z.number().int().min(0, 'Deposit paid must be 0 or positive paise').default(0),
  moveInDate: z.string().min(1, 'Move-in date required'),
  initialRentAmountPaise: z.number().int().positive().optional(),
});

export const updateTenantSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/).optional(),
  idProofType: z.string().optional(),
  securityDepositPaise: z.number().int().min(0).optional(),
});

// Deposit ledger entry schema
export const depositEntrySchema = z.object({
  type: z.enum(['installment', 'deduction', 'refund']),
  amountPaise: z.number().int().positive('Amount must be positive paise'),
  reason: z.string().min(2, 'Reason is required'),
  reference: z.string().optional(),
});

// Line item schema
export const lineItemSchema = z.object({
  label: z.string().min(1, 'Label required'),
  amountPaise: z.number().int().positive('Amount must be positive paise'),
});

// Rent record creation schema
export const createRentRecordSchema = z.object({
  tenantId: z.string().min(1, 'Tenant ID required'),
  period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
  lineItems: z.array(lineItemSchema).min(1, 'At least one line item is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  prorated: z.boolean().optional().default(false),
});

// Rent confirmation schema
export const confirmRentSchema = z.object({
  paymentReference: z.string().optional(),
  notes: z.string().optional(),
});

// SaaS plan upgrade request schema
export const subscriptionUpgradeSchema = z.object({
  requestedPlan: z.enum([PLAN_TIER.GROWTH, PLAN_TIER.PRO]),
  billingCycle: z.enum(['monthly', 'yearly']),
  amountPaise: z.number().int().positive(),
  utrReference: z.string().min(6, 'Please enter a valid 12-digit UTR reference'),
});
