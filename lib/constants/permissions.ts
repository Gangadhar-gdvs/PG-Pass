// ---------------------------------------------------------------------------
// Authorization vocabulary — enforced SERVER-SIDE (withAuth + services), never
// as a client-only filter.
//
//  * STAFF_PERMISSIONS: owner-assigned, per-staff. Each staff member carries an
//    independent `permissions` array on their staff doc. No merging between
//    staff. An action gated by a permission is allowed for a staff member only
//    if that key is present; owners and admins always bypass.
//
//  * PG_FEATURES: admin-assigned, per-PG (owner doc `features` map). Lets the
//    platform admin enable/disable whole features for a specific PG. Absent/true
//    means enabled (fail-open to avoid breaking existing PGs); explicit false
//    disables server-side.
// ---------------------------------------------------------------------------

export const STAFF_PERMISSIONS = {
  COLLECT_RENT: 'collect_rent', // record/confirm payments, reminders
  MANAGE_TENANTS: 'manage_tenants', // add/move residents, deposits
  MANAGE_BEDS: 'manage_beds', // bed inventory
  MANAGE_GUESTS: 'manage_guests', // guest check-in/out
  MANAGE_MAINTENANCE: 'manage_maintenance', // resolve tickets
  MANAGE_EXPENSES: 'manage_expenses', // log expenses
  MANAGE_PHOTOS: 'manage_photos', // PG gallery + tenant photos
  VIEW_ANALYTICS: 'view_analytics', // dashboards/analytics
} as const;

export type StaffPermission = (typeof STAFF_PERMISSIONS)[keyof typeof STAFF_PERMISSIONS];

export const ALL_STAFF_PERMISSIONS: StaffPermission[] = Object.values(STAFF_PERMISSIONS);

// Sensible default granted to a freshly-invited warden: day-to-day operations,
// but NOT expenses/analytics until the owner opts them in.
export const DEFAULT_STAFF_PERMISSIONS: StaffPermission[] = [
  STAFF_PERMISSIONS.COLLECT_RENT,
  STAFF_PERMISSIONS.MANAGE_TENANTS,
  STAFF_PERMISSIONS.MANAGE_BEDS,
  STAFF_PERMISSIONS.MANAGE_GUESTS,
  STAFF_PERMISSIONS.MANAGE_MAINTENANCE,
];

export const STAFF_PERMISSION_LABELS: Record<StaffPermission, string> = {
  [STAFF_PERMISSIONS.COLLECT_RENT]: 'Collect & confirm rent',
  [STAFF_PERMISSIONS.MANAGE_TENANTS]: 'Manage residents & deposits',
  [STAFF_PERMISSIONS.MANAGE_BEDS]: 'Manage bed inventory',
  [STAFF_PERMISSIONS.MANAGE_GUESTS]: 'Manage guest stays',
  [STAFF_PERMISSIONS.MANAGE_MAINTENANCE]: 'Handle maintenance issues',
  [STAFF_PERMISSIONS.MANAGE_EXPENSES]: 'Log expenses',
  [STAFF_PERMISSIONS.MANAGE_PHOTOS]: 'Manage photos',
  [STAFF_PERMISSIONS.VIEW_ANALYTICS]: 'View analytics',
};

export const PG_FEATURES = {
  DISCOVERY: 'discovery', // public listing in PG search
  REVIEWS: 'reviews', // accept resident/guest/staff reviews
  PHOTO_GALLERY: 'photo_gallery', // PG gallery photos
  GUESTS: 'guests', // guest/short-stay flow
  STAFF: 'staff', // staff delegation
  ANALYTICS: 'analytics', // analytics dashboards
  MAINTENANCE: 'maintenance', // maintenance tickets
  EXPENSES: 'expenses', // expense tracking
} as const;

export type PgFeature = (typeof PG_FEATURES)[keyof typeof PG_FEATURES];

export const ALL_PG_FEATURES: PgFeature[] = Object.values(PG_FEATURES);

export const PG_FEATURE_LABELS: Record<PgFeature, string> = {
  [PG_FEATURES.DISCOVERY]: 'Public PG discovery listing',
  [PG_FEATURES.REVIEWS]: 'Resident & staff reviews',
  [PG_FEATURES.PHOTO_GALLERY]: 'PG photo gallery',
  [PG_FEATURES.GUESTS]: 'Guest / short-stay flow',
  [PG_FEATURES.STAFF]: 'Staff delegation',
  [PG_FEATURES.ANALYTICS]: 'Analytics dashboards',
  [PG_FEATURES.MAINTENANCE]: 'Maintenance tickets',
  [PG_FEATURES.EXPENSES]: 'Expense tracking',
};
