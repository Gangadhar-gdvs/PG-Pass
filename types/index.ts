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
export type BedStatus = 'vacant' | 'occupied' | 'maintenance' | 'paid' | 'pending' | 'verify';
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
  pgAmenities?: string[];
  createdAt?: any;
  updatedAt?: any;
}

export interface Bed {
  id: string;
  ownerId: string;
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
  ownerName?: string;
  bedId: string;
  bedLabel?: string;
  roomNumber?: string;
  name: string;
  phone: string;
  phoneLast4?: string;
  idProofType?: string;
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

export interface DepositRecord {
  id: string;
  ownerId: string;
  tenantId: string;
  type: 'installment' | 'deduction' | 'refund';
  amountPaise: number;
  reason: string;
  reference?: string;
  recordedBy: string;
  createdAt: any;
}

export interface RentRecord {
  id: string;
  ownerId: string;
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
