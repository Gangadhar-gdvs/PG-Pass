import {
  ACCOUNT_STATUS,
  AccountStatus,
  PHOTO_TYPE,
  PhotoType,
  PLAN_TIER,
  PlanTier,
  SUBSCRIPTION_REQUEST_STATUS,
  SubscriptionRequestStatus,
  ROLE,
  Role,
} from '@/lib/constants/status';

export * from '@/lib/constants/status';

// Expanded BedStatus to support both Rev 3 spec and legacy UI prototype indicators
export type BedStatus = 'vacant' | 'occupied' | 'maintenance' | 'guest' | 'paid' | 'pending' | 'verify';

/** Short-stay guest (comes and goes within days) — a lightweight alternative to
 *  a full-time tenant: no monthly rent cycle, no deposit ledger, no portal. */
export interface GuestStay {
  id: string;
  ownerId: string;
  propertyId?: string;
  bedId: string;
  bedLabel?: string;
  roomNumber?: string;
  name: string;
  phone?: string;
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD (planned)
  nights: number;
  billingMode: 'per_night' | 'flat';
  nightlyRatePaise?: number;
  totalAmountPaise: number;
  amountPaidPaise: number;
  idProofType?: string;
  notes?: string;
  status: 'active' | 'completed';
  checkedOutAt?: any;
  recordedBy: string;
  createdAt?: any;
}
export type RentStatus = 'pending' | 'verify' | 'paid';

export interface LineItem {
  label: string;
  amountPaise: number;
}

export interface Owner {
  id: string; // Auth UID
  name: string;
  email?: string;
  phone: string;
  pgName: string;
  pgAddress: string;
  address?: string;
  city?: string;
  area?: string;
  isListed?: boolean;
  panNumber?: string;
  upiId: string;
  upiMerchantName?: string;
  accountStatus?: AccountStatus;
  plan?: PlanTier;
  subscriptionExpiresAt?: any;
  maxBeds?: number;
  maxTenants?: number;
  maxPhotos?: number;
  maxStaff?: number;
  nextReceiptSeq?: number;
  totalFloors?: number;
  roomsPerFloor?: number;
  bedsPerRoom?: number;
  monthlyRent?: number;
  pgCategory?: 'gents' | 'ladies' | 'coliving';
  foodPlan?: '3_meals' | '2_meals' | 'no_food';
  foodCuisine?: 'both' | 'south' | 'north';
  noticePeriodDays?: number;
  rentDueDay?: number; // day of month rent is due (1–28); defaults to 5
  lateFeePerDayPaise?: number; // optional late fee accrued per overdue day
  lateFeeGraceDays?: number; // days after due date before late fee starts
  pgAmenities?: string[];
  createdAt?: any;
  updatedAt?: any;
}

export interface Resident {
  id: string; // Firebase Auth UID
  name: string;
  phone: string; // cleaned 10-digit; the key that links to tenant records
  email?: string;
  createdAt?: any;
  updatedAt?: any;
}

/** A resident's request to join a PG they discovered publicly. */
export interface JoinRequest {
  id: string;
  propertyId: string;
  ownerId: string;
  residentId: string;
  residentName: string;
  residentPhone: string;
  message?: string;
  status: 'pending' | 'approved' | 'declined';
  createdAt?: any;
  reviewedAt?: any;
  reviewedBy?: string;
}

export interface Property {
  id: string; // random; the PRIMARY property's id equals the owner's uid
  ownerId: string;
  isPrimary?: boolean;
  pgName: string;
  pgAddress?: string;
  city?: string; // for public discovery / search
  area?: string;
  isListed?: boolean; // owner opted this property into public discovery
  pgCategory?: 'gents' | 'ladies' | 'coliving';
  foodPlan?: '3_meals' | '2_meals' | 'no_food';
  foodCuisine?: 'both' | 'south' | 'north';
  totalFloors?: number;
  roomsPerFloor?: number;
  bedsPerRoom?: number;
  monthlyRent?: number;
  rentDueDay?: number;
  lateFeePerDayPaise?: number;
  lateFeeGraceDays?: number;
  pgAmenities?: string[];
  nextReceiptSeq?: number; // per-property receipt counter
  createdAt?: any;
  updatedAt?: any;
}

export interface Bed {
  id: string;
  ownerId: string;
  propertyId?: string; // defaults to ownerId (primary property) for legacy data
  floor: number;
  roomNumber: string;
  bedLabel: string;
  rentAmountPaise?: number;
  monthlyRent: number; // required number for formatCurrency(bed.monthlyRent)
  status: BedStatus;
  sharingType?: '1' | '2' | '3' | '4' | '5' | '6';
  acType?: 'ac' | 'non-ac';
  roomAmenities?: string[];
  tenantId?: string;
  tenantName?: string;
  tenantPhone?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Tenant {
  id: string;
  ownerId: string;
  propertyId?: string; // defaults to ownerId (primary property) for legacy data
  ownerName?: string;
  bedId: string;
  bedLabel?: string;
  roomNumber?: string;
  name: string;
  phone: string;
  phoneLast4?: string;
  idProofType?: string;
  idProofPhotoId?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  accountStatus?: AccountStatus;
  securityDepositPaise?: number;
  depositPaidPaise?: number;
  monthlyRent?: number;
  depositPaid?: number;
  moveInDate: string;
  moveOutDate?: string;
  deletedAt?: any;
  deletedBy?: string;
  active?: boolean;
  token?: string;
  createdAt?: any;
  updatedAt?: any;
}

export type MaintenanceCategory =
  | 'plumbing'
  | 'electrical'
  | 'wifi'
  | 'furniture'
  | 'cleaning'
  | 'appliance'
  | 'other';
export type MaintenanceStatus = 'open' | 'in_progress' | 'resolved';

export interface MaintenanceTicket {
  id: string;
  ownerId: string;
  propertyId?: string;
  tenantId: string;
  tenantName?: string;
  bedLabel?: string;
  roomNumber?: string;
  category: MaintenanceCategory;
  description: string;
  photoId?: string;
  status: MaintenanceStatus;
  resolvedBy?: string;
  resolvedAt?: any;
  resolutionNote?: string;
  createdAt?: any;
  updatedAt?: any;
}

export type ExpenseCategory =
  | 'salary'
  | 'utilities'
  | 'maintenance'
  | 'supplies'
  | 'food'
  | 'rent'
  | 'internet'
  | 'other';

export interface Expense {
  id: string;
  ownerId: string;
  propertyId?: string;
  category: ExpenseCategory;
  amountPaise: number;
  note?: string;
  vendor?: string;
  date: string; // YYYY-MM-DD
  period: string; // YYYY-MM (derived from date, for monthly grouping)
  recordedBy: string;
  createdAt?: any;
}

export type RefundStatus = 'pending' | 'issued';

export interface DepositRecord {
  id: string;
  ownerId: string;
  propertyId?: string;
  tenantId: string;
  type: 'installment' | 'deduction' | 'refund';
  amountPaise: number;
  reason: string;
  reference?: string;
  recordedBy: string;
  // Only meaningful for type==='refund': tracks whether the money has actually
  // been paid out to the tenant yet.
  refundStatus?: RefundStatus;
  issuedBy?: string;
  issuedAt?: any;
  tenantName?: string;
  createdAt: any;
}

export interface RentRecord {
  id: string;
  ownerId: string;
  propertyId?: string;
  tenantId: string;
  tenantName?: string;
  bedId?: string;
  bedLabel?: string;
  roomNumber?: string;
  period?: string; // YYYY-MM
  monthYear?: string; // legacy prototype property ("Nov-2026")
  lineItems?: LineItem[];
  prorated?: boolean;
  amountDuePaise?: number;
  amountPaidPaise?: number;
  amount?: number;
  status: RentStatus;
  dueDate?: string;
  paidDate?: string;
  paymentReference?: string;
  proofPhotoId?: string;
  proofImageUrl?: string;
  claimedAt?: any;
  confirmedAt?: any;
  confirmedBy?: string;
  receiptNumber?: number;
  lastRemindedAt?: any;
  reversedAt?: any;
  reversalReason?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface MoveInPhoto {
  id: string;
  ownerId: string;
  propertyId?: string;
  tenantId: string;
  rentRecordId?: string;
  photoType?: PhotoType;
  storageProvider?: 'b2';
  objectKey?: string;
  contentType?: string;
  sizeBytes?: number;
  sha256?: string;
  uploadedBy?: string;
  photoUrls?: string[];
  timestamp?: any;
  createdAt?: any;
}

export interface PortalToken {
  tokenHash: string;
  tenantId: string;
  ownerId: string;
  expiresAt: any;
  singleUse: boolean;
  usedAt?: any;
  revokedAt?: any;
  createdAt: any;
}

export interface SubscriptionRequest {
  id: string;
  ownerId: string;
  requestedPlan: PlanTier;
  billingCycle: 'monthly' | 'yearly';
  amountPaise: number;
  utrReference: string;
  status: SubscriptionRequestStatus;
  reviewedBy?: string;
  reviewedAt?: any;
  notes?: string;
  createdAt: any;
}
