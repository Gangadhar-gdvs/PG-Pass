import { STAFF_PERMISSIONS as P, type StaffPermission } from '@/lib/constants/permissions';

/**
 * Classification of every `match` block in firestore.rules by access pattern.
 * coverage.test.ts fails if a collection is added to (or removed from) the rules
 * without being listed here, so a new collection automatically gets the full
 * deny-writes + read-matrix treatment once you drop it into the right bucket.
 *
 * Adding a collection:
 *   - `canReadOwnerScope(ownerId)` (+ bounded list)            → OWNER_SCOPED with []
 *   - `canReadOwnerScopeWith(ownerId, perms)` (+ bounded list) → OWNER_SCOPED with those perms
 *   - owner + admin only (no staff)                            → OWNER_ADMIN_ONLY
 *   - `allow read, write: if false`                            → SERVER_ONLY
 *   - anything else → SPECIAL, and add explicit cases to special.test.ts
 */

const TENANCY: readonly StaffPermission[] = [P.MANAGE_TENANTS, P.COLLECT_RENT];

/**
 * get/list: the owner, admin, and ACTIVE staff of that owner (live staff doc:
 * exists, same ownerId, accountStatus active) holding ANY of the listed
 * permissions ([] = any active staff). Lists must filter ownerId, limit ≤ 100.
 */
export const OWNER_SCOPED: Readonly<Record<string, readonly StaffPermission[]>> = {
  beds: [],
  properties: [],
  staff_ratings: [],
  tenants: TENANCY,
  deposits: TENANCY,
  rent_records: TENANCY,
  movein_photos: [P.MANAGE_TENANTS, P.MANAGE_PHOTOS],
  maintenance_tickets: [P.MANAGE_MAINTENANCE],
  expenses: [P.MANAGE_EXPENSES],
  utility_bills: [P.MANAGE_EXPENSES],
  assets: [P.MANAGE_BEDS],
  guest_stays: [P.MANAGE_GUESTS],
};

/** get/list: the owner (list filtered by ownerId) and admin. Never staff. */
export const OWNER_ADMIN_ONLY = ['subscription_requests', 'owner_notifications'] as const;

/** `allow get: if isAdmin(); allow list: if isAdmin() && boundedList()`. */
export const ADMIN_BOUNDED = ['audit_logs', 'admin_notifications', 'support_flags'] as const;

/** No client access at all — served exclusively through app/api via the Admin SDK. */
export const SERVER_ONLY = [
  'notices',
  'staff_tasks',
  'visitors',
  'join_requests',
  'admin_users',
  'portal_tokens',
  'portal_lockouts',
  'utr_claims',
  'rate_limits',
  'idempotency_keys',
  'property_photos', // R-S1/R-S2: public data is served as DTOs by /api/discover + /api/reviews
  'pg_reviews',
] as const;

/** Bespoke rules, each covered explicitly in special.test.ts. */
export const SPECIAL = [
  'owners',
  'staff',
  'support_threads',
  'support_threads/*/messages',
  'residents',
  'metrics',
] as const;

/** Collections with no explicit match — they fall through to `/{document=**}` (deny). */
export const CATCH_ALL_EXAMPLES = ['system_logs', 'some_future_collection', 'beds/*/history'] as const;

export const ALL_CLASSIFIED: readonly string[] = [
  ...Object.keys(OWNER_SCOPED),
  ...OWNER_ADMIN_ONLY,
  ...ADMIN_BOUNDED,
  ...SERVER_ONLY,
  ...SPECIAL,
  '**',
];
