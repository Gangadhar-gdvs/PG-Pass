import 'server-only';
import { adminDb } from '../firebase-admin';
import { StaffPermission, PgFeature, ALL_STAFF_PERMISSIONS } from '@/lib/constants/permissions';

/**
 * Server-side authorization reads with a short in-memory cache (entitlements
 * change rarely; a 60s TTL keeps hot paths off Firestore). ALL gating that uses
 * these happens on the server — the client never decides access.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}
const TTL_MS = 60_000;
const staffPermCache = new Map<string, CacheEntry<StaffPermission[]>>();
const featureCache = new Map<string, CacheEntry<Record<string, boolean>>>();

/** A staff member's granted permissions (empty array if none set). */
export async function getStaffPermissions(staffUid: string): Promise<StaffPermission[]> {
  const now = Date.now();
  const cached = staffPermCache.get(staffUid);
  if (cached && cached.expiresAt > now) return cached.value;

  const snap = await adminDb.collection('staff').doc(staffUid).get();
  const raw = (snap.data()?.permissions as string[] | undefined) || [];
  // Keep only known permission keys.
  const value = raw.filter((p): p is StaffPermission =>
    (ALL_STAFF_PERMISSIONS as string[]).includes(p)
  );
  staffPermCache.set(staffUid, { value, expiresAt: now + TTL_MS });
  return value;
}

export function invalidateStaffPermissions(staffUid: string) {
  staffPermCache.delete(staffUid);
}

/** True if this staff member holds the given permission. */
export async function staffHasPermission(
  staffUid: string,
  permission: StaffPermission
): Promise<boolean> {
  const perms = await getStaffPermissions(staffUid);
  return perms.includes(permission);
}

/**
 * Admin-controlled per-PG feature flags. Fail-OPEN: a feature is enabled unless
 * the owner doc explicitly sets `features.<key> === false`. This avoids locking
 * existing PGs out of features that predate the flag map.
 */
export async function getPgFeatures(ownerId: string): Promise<Record<string, boolean>> {
  const now = Date.now();
  const cached = featureCache.get(ownerId);
  if (cached && cached.expiresAt > now) return cached.value;

  const snap = await adminDb.collection('owners').doc(ownerId).get();
  const value = (snap.data()?.features as Record<string, boolean> | undefined) || {};
  featureCache.set(ownerId, { value, expiresAt: now + TTL_MS });
  return value;
}

export function invalidatePgFeatures(ownerId: string) {
  featureCache.delete(ownerId);
}

/** True unless the admin explicitly disabled this feature for the PG. */
export async function pgFeatureEnabled(ownerId: string, feature: PgFeature): Promise<boolean> {
  const features = await getPgFeatures(ownerId);
  return features[feature] !== false;
}
