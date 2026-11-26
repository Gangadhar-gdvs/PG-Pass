import { z } from 'zod';
import { BED_STATUS, PLAN_TIER } from '@/lib/constants/status';
import {
  UTILITY_TYPES,
  UTILITY_SCOPES,
  UTILITY_ALLOCATION_RULES,
  MAX_UTILITY_BILL_PAISE,
  isValidIsoDate,
  isValidPeriod,
} from '@/lib/utilitySplit';
import { ASSET_CATEGORIES, ASSET_CONDITIONS, ASSET_LOCATIONS, MAX_ASSET_QUANTITY } from '@/lib/assets';

// Owner onboarding and update schema
export const ownerProfileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian phone number'),
  pgName: z.string().min(2, 'PG Name must be at least 2 characters'),
  address: z.string().min(5, 'Address must be at least 5 characters'),
  upiId: z.string().regex(/^[\w.-]+@[\w.-]+$/, 'Invalid UPI ID format (e.g. name@bank)'),
  upiMerchantName: z.string().optional(),
  pgCategory: z.enum(['gents', 'ladies', 'coliving']).optional(),
  foodPlan: z.enum(['3_meals', '2_meals', 'no_food']).optional(),
  foodCuisine: z.enum(['both', 'south', 'north']).optional(),
  noticePeriodDays: z.number().int().optional(),
  city: z.string().max(60).optional(),
  area: z.string().max(80).optional(),
  isListed: z.boolean().optional(),
  rentDueDay: z.number().int().min(1).max(28).optional(),
  lateFeePerDayPaise: z.number().int().min(0).optional(),
  lateFeeGraceDays: z.number().int().min(0).max(28).optional(),
  pgAmenities: z.array(z.string()).optional(),
  totalFloors: z.number().int().optional(),
});

// Bed creation and update schema
export const createBedSchema = z.object({
  roomNumber: z.string().min(1, 'Room number required'),
  bedLabel: z.string().min(1, 'Bed label required'),
  rentAmountPaise: z.number().int().positive('Rent must be a positive integer in paise'),
  floor: z.number().int().min(0).default(1),
  sharingType: z.enum(['1', '2', '3', '4', '5', '6']).optional(),
  acType: z.enum(['ac', 'non-ac']).optional(),
  roomAmenities: z.array(z.string()).optional(),
});

export const createBedsBatchSchema = z.object({
  beds: z.array(createBedSchema).min(1).max(200),
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
  emergencyContactName: z.string().max(60).optional(),
  emergencyContactPhone: z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit mobile number').optional().or(z.literal('')),
  emergencyContactRelation: z.string().max(40).optional(),
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
  // Optional client-generated key; a retried submission with the same key is a
  // no-op (prevents double-counting a deposit).
  idempotencyKey: z.string().min(8).max(100).optional(),
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
  // amountPaise is accepted for backward-compat but IGNORED — the server computes
  // the canonical price (see subscriptions.service PLAN_PRICES_PAISE).
  amountPaise: z.number().int().positive().optional(),
  utrReference: z.string().min(6, 'Please enter a valid 12-digit UTR reference'),
});

// ---------------------------------------------------------------------------
// Utility bills (business rules — meter order, custom sums, duplicates — are
// enforced in lib/utilitySplit.ts + utilities.service, not here).
// ---------------------------------------------------------------------------

const billingPeriod = z.string().refine(isValidPeriod, 'Billing month must be in YYYY-MM format');
const utilityPaise = z
  .number()
  .int('Amount must be whole paise')
  .min(0, 'Amount cannot be negative')
  .max(MAX_UTILITY_BILL_PAISE, 'Amount is too large');

export const utilityBillInputSchema = z
  .object({
    propertyId: z.string().trim().min(1).max(128).optional(),
    type: z.enum(UTILITY_TYPES),
    provider: z.string().trim().max(80).optional(),
    period: billingPeriod,
    scope: z.enum(UTILITY_SCOPES),
    roomNumber: z.string().trim().min(1).max(20).optional(),
    totalPaise: utilityPaise,
    meter: z
      .object({
        previous: z.number().min(0).max(1_000_000_000),
        current: z.number().min(0).max(1_000_000_000),
        reset: z.boolean().optional().default(false),
      })
      .nullable()
      .optional(),
    notes: z.string().trim().max(300).optional(),
    rule: z.enum(UTILITY_ALLOCATION_RULES),
    customPaise: z.record(z.string().min(1).max(128), utilityPaise).optional(),
  })
  .refine((v) => v.scope !== 'room' || !!v.roomNumber, {
    message: 'Choose the room this bill is for',
    path: ['roomNumber'],
  });

export type UtilityBillInputData = z.infer<typeof utilityBillInputSchema>;

export const voidUtilityBillSchema = z.object({
  reason: z.string().trim().min(3, 'Please give a short reason').max(200),
});

// ---------------------------------------------------------------------------
// Room inventory / assets
// ---------------------------------------------------------------------------

const isoDate = z.string().refine(isValidIsoDate, 'Use a valid date (YYYY-MM-DD)');

export const createAssetSchema = z
  .object({
    propertyId: z.string().trim().min(1).max(128).optional(),
    location: z.enum(ASSET_LOCATIONS),
    roomNumber: z.string().trim().min(1).max(20).optional(),
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
    category: z.enum(ASSET_CATEGORIES),
    quantity: z.number().int().min(1, 'Quantity must be at least 1').max(MAX_ASSET_QUANTITY),
    condition: z.enum(ASSET_CONDITIONS).default('good'),
    purchaseDate: isoDate.nullable().optional(),
    warrantyUntil: isoDate.nullable().optional(),
    notes: z.string().trim().max(300).optional(),
  })
  .refine((v) => v.location !== 'room' || !!v.roomNumber, {
    message: 'Choose the room this item is in',
    path: ['roomNumber'],
  })
  .refine((v) => !v.purchaseDate || !v.warrantyUntil || v.warrantyUntil >= v.purchaseDate, {
    message: 'Warranty end date cannot be before the purchase date',
    path: ['warrantyUntil'],
  });

export type CreateAssetData = z.infer<typeof createAssetSchema>;

export const updateAssetSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    category: z.enum(ASSET_CATEGORIES).optional(),
    // 0 is allowed (e.g. all units written off) — never negative.
    quantity: z.number().int().min(0, 'Quantity cannot be negative').max(MAX_ASSET_QUANTITY).optional(),
    condition: z.enum(ASSET_CONDITIONS).optional(),
    purchaseDate: isoDate.nullable().optional(),
    warrantyUntil: isoDate.nullable().optional(),
    notes: z.string().trim().max(300).nullable().optional(),
    // Why this change was made — stored on the history entry only.
    note: z.string().trim().max(200).optional(),
  })
  .refine(
    (v) =>
      ['name', 'category', 'quantity', 'condition', 'purchaseDate', 'warrantyUntil', 'notes'].some(
        (k) => v[k as keyof typeof v] !== undefined
      ),
    { message: 'Nothing to update' }
  );

export type UpdateAssetData = z.infer<typeof updateAssetSchema>;
