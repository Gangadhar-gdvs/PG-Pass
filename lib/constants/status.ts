export const RENT_STATUS = {
  PENDING: 'pending',
  VERIFY: 'verify',
  PAID: 'paid',
} as const;

export type RentStatus = (typeof RENT_STATUS)[keyof typeof RENT_STATUS];

export const ACCOUNT_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  PENDING_REVIEW: 'pending_review',
} as const;

export type AccountStatus = (typeof ACCOUNT_STATUS)[keyof typeof ACCOUNT_STATUS];

export const BED_STATUS = {
  VACANT: 'vacant',
  OCCUPIED: 'occupied',
  MAINTENANCE: 'maintenance',
} as const;

export type BedStatus = (typeof BED_STATUS)[keyof typeof BED_STATUS];

export const PHOTO_TYPE = {
  MOVE_IN: 'move_in',
  MOVE_OUT: 'move_out',
  PAYMENT_PROOF: 'payment_proof',
} as const;

export type PhotoType = (typeof PHOTO_TYPE)[keyof typeof PHOTO_TYPE];

export const PLAN_TIER = {
  FREE: 'free',
  GROWTH: 'growth',
  PRO: 'pro',
} as const;

export type PlanTier = (typeof PLAN_TIER)[keyof typeof PLAN_TIER];

export const SUBSCRIPTION_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type SubscriptionRequestStatus =
  (typeof SUBSCRIPTION_REQUEST_STATUS)[keyof typeof SUBSCRIPTION_REQUEST_STATUS];

export const ROLE = {
  OWNER: 'owner',
  STAFF: 'staff',
  ADMIN: 'admin',
  TENANT: 'tenant',
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];
