/**
 * Classification of every `match` block in firestore.rules by access pattern.
 * coverage.test.ts fails if a collection is added to (or removed from) the rules
 * without being listed here, so a new collection automatically gets the full
 * deny-writes + read-matrix treatment once you drop it into the right bucket.
 *
 * Adding a collection (e.g. `utility_bills`, `assets`):
 *   - rule is `canReadOwnerScope(resource.data.ownerId)` + bounded list → OWNER_SCOPED
 *   - `allow read, write: if false`                                     → SERVER_ONLY
 *   - anything else → SPECIAL, and add explicit cases to special.test.ts
 */

/** get/list: owner, that owner's staff, admin. list must filter ownerId and limit ≤ 100. */
export const OWNER_SCOPED = [
  'beds',
  'tenants',
  'deposits',
  'rent_records',
  'movein_photos',
  'maintenance_tickets',
  'owner_notifications',
  'expenses',
  'guest_stays',
  'properties',
  'staff_ratings',
  'utility_bills',
  'assets',
] as const;

/** get: anyone (signed out too). list: anyone with limit ≤ 100. */
export const PUBLIC_READ = ['property_photos', 'pg_reviews'] as const;

/** `allow get, list: if isAdmin() && boundedList()`. */
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
] as const;

/** Bespoke rules, each covered explicitly in special.test.ts. */
export const SPECIAL = [
  'owners',
  'staff',
  'subscription_requests',
  'support_threads',
  'support_threads/*/messages',
  'residents',
  'metrics',
] as const;

/** Collections with no explicit match — they fall through to `/{document=**}` (deny). */
export const CATCH_ALL_EXAMPLES = ['system_logs', 'some_future_collection', 'beds/*/history'] as const;

export const ALL_CLASSIFIED: readonly string[] = [
  ...OWNER_SCOPED,
  ...PUBLIC_READ,
  ...ADMIN_BOUNDED,
  ...SERVER_ONLY,
  ...SPECIAL,
  '**',
];
