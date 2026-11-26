import {
  AccountStatus,
  PhotoType,
  PlanTier,
  SubscriptionRequestStatus,
} from '@/lib/constants/status';

export * from '@/lib/constants/status';

/**
 * A Firestore timestamp as it appears on documents across the app. Both the
 * firebase-admin and client `Timestamp` expose `toDate()`/`toMillis()`; writes
 * may use a server-timestamp sentinel (`FieldValue`); and some legacy/serialized
 * paths carry a `Date`, ISO string, or epoch number. This captures exactly what
 * the code relies on (`?.toDate?.()`, `?.toMillis?.()`) without coupling the
 * shared types to either SDK — replacing the former `any` on every date field.
 */
export interface FirestoreTimestamp {
  toDate?: () => Date;
  toMillis?: () => number;
  seconds?: number;
  nanoseconds?: number;
}
export type Timestampish = FirestoreTimestamp | Date | string | number;

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
  checkedOutAt?: Timestampish;
  recordedBy: string;
  createdAt?: Timestampish;
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
  upiId: string;
  upiMerchantName?: string;
  accountStatus?: AccountStatus;
  plan?: PlanTier;
  subscriptionExpiresAt?: Timestampish;
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
  createdAt?: Timestampish;
  updatedAt?: Timestampish;
}

/** Owner↔admin support thread (one per owner). Messages live in a subcollection. */
export interface SupportThread {
  id: string; // == ownerId
  ownerId: string;
  ownerName?: string;
  pgName?: string;
  lastMessage?: string;
  lastSender?: 'owner' | 'admin';
  lastAt?: Timestampish;
  unreadForAdmin?: number;
  unreadForOwner?: number;
  createdAt?: Timestampish;
}

export interface SupportMessage {
  id: string;
  threadId: string; // == ownerId
  sender: 'owner' | 'admin';
  senderUid: string;
  text: string;
  createdAt?: Timestampish;
}

export interface Resident {
  id: string; // Firebase Auth UID
  name: string;
  phone: string; // cleaned 10-digit; the key that links to tenant records
  email?: string;
  createdAt?: Timestampish;
  updatedAt?: Timestampish;
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
  createdAt?: Timestampish;
  reviewedAt?: Timestampish;
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
  createdAt?: Timestampish;
  updatedAt?: Timestampish;
}

// PG gallery photo (PUBLIC) — shown to prospective residents in discovery.
export interface PropertyPhoto {
  id: string;
  ownerId: string;
  propertyId: string;
  category: 'exterior' | 'room' | 'bathroom' | 'common' | 'food' | 'amenity' | 'other';
  caption?: string; // e.g. "2-sharing AC room", "1st floor bathroom"
  sharingType?: '1' | '2' | '3' | '4' | '5' | '6'; // optional, for room photos
  objectKey: string;
  publicUrl: string; // stable public-read URL on B2
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt?: Timestampish;
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
  createdAt?: Timestampish;
  updatedAt?: Timestampish;
  deletedAt?: Timestampish | null; // soft-delete marker; absent/null = active
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
  deletedAt?: Timestampish | null;
  deletedBy?: string;
  active?: boolean;
  token?: string;
  createdAt?: Timestampish;
  updatedAt?: Timestampish;
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

/** In-app notice/announcement from an owner to residents and/or staff. */
export type NoticeAudience = 'all' | 'residents' | 'staff';
export interface Notice {
  id: string;
  ownerId: string;
  propertyId?: string;
  title: string;
  body: string;
  audience: NoticeAudience; // who sees it
  roomNumber?: string; // optional: scope to one room's residents
  pinned?: boolean;
  publishedAt?: Timestampish; // when it goes live (now or scheduled)
  expiresAt?: Timestampish | null; // optional auto-hide
  createdBy: string;
  createdByName?: string;
  readBy?: string[]; // uids/tenantIds that have read it
  deletedAt?: Timestampish | null; // soft-delete
  createdAt?: Timestampish;
  updatedAt?: Timestampish;
}

/** A visitor entry at the PG gate (minimal data, retention-limited). */
export interface Visitor {
  id: string;
  ownerId: string;
  propertyId?: string;
  name: string;
  purpose?: string;
  visitingResident?: string; // resident name (free text; no linkage required)
  roomNumber?: string;
  phone?: string; // optional, minimal collection
  checkInAt: Timestampish;
  checkOutAt?: Timestampish | null;
  status: 'in' | 'out';
  recordedBy: string;
  createdAt?: Timestampish;
}

/** A staff task assigned by the owner (housekeeping, checks, handover, etc.). */
export type StaffTaskStatus = 'open' | 'done';
export interface StaffTask {
  id: string;
  ownerId: string;
  propertyId?: string;
  title: string;
  note?: string;
  assignedToUid?: string; // staff uid (unassigned = any staff / general)
  assignedToName?: string;
  dueDate?: string; // YYYY-MM-DD
  status: StaffTaskStatus;
  completedBy?: string;
  completedAt?: Timestampish;
  createdBy: string;
  deletedAt?: Timestampish | null;
  createdAt?: Timestampish;
  updatedAt?: Timestampish;
}

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
  resolvedAt?: Timestampish;
  resolutionNote?: string;
  createdAt?: Timestampish;
  updatedAt?: Timestampish;
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
  createdAt?: Timestampish;
  deletedAt?: Timestampish | null; // soft-delete marker; absent/null = active
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
  issuedAt?: Timestampish;
  tenantName?: string;
  createdAt: Timestampish;
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
  claimedAt?: Timestampish;
  confirmedAt?: Timestampish;
  confirmedBy?: string;
  receiptNumber?: number;
  lastRemindedAt?: Timestampish;
  reversedAt?: Timestampish;
  reversalReason?: string;
  createdAt?: Timestampish;
  updatedAt?: Timestampish;
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
  timestamp?: Timestampish;
  createdAt?: Timestampish;
}

export interface PortalToken {
  tokenHash: string;
  tenantId: string;
  ownerId: string;
  expiresAt: Timestampish;
  singleUse: boolean;
  usedAt?: Timestampish;
  revokedAt?: Timestampish;
  createdAt: Timestampish;
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
  reviewedAt?: Timestampish;
  notes?: string;
  createdAt: Timestampish;
}
