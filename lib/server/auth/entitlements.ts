import 'server-only';
import { adminDb } from '../firebase-admin';
import {
  StaffPermission,
  PgFeature,
  ALL_STAFF_PERMISSIONS,
  AdminPermission,
  AdminRole,
  ALL_ADMIN_PERMISSIONS,
  ADMIN_ROLE,
} from '@/lib/constants/permissions';

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
const adminEntCache = new Map<string, CacheEntry<AdminEntitlements>>();

export interface AdminEntitlements {
  role: AdminRole;
  permissions: AdminPermission[];
  accountStatus: string; // 'active' | 'suspended' | ...
  exists: boolean; // whether an admin_users doc exists for this uid
}

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

/**
 * A platform admin's role + granted permissions, from the `admin_users` doc.
 *
 * Backward-compat: an account that has the `admin:true` custom claim but NO
 * `admin_users` doc (i.e. a legacy admin created before this system) is treated
 * as a SUPER admin with all permissions — so existing admins never lose access.
 * The migration/claims flow writes real docs going forward.
 */
export async function getAdminEntitlements(adminUid: string): Promise<AdminEntitlements> {
  const now = Date.now();
  const cached = adminEntCache.get(adminUid);
  if (cached && cached.expiresAt > now) return cached.value;

  const snap = await adminDb.collection('admin_users').doc(adminUid).get();
  let value: AdminEntitlements;
  if (!snap.exists) {
    // Legacy admin (claim only, no doc) → full super access, fail-safe.
    value = { role: ADMIN_ROLE.SUPER, permissions: [...ALL_ADMIN_PERMISSIONS], accountStatus: 'active', exists: false };
  } else {
    const data = snap.data()!;
    const role: AdminRole = data.role === ADMIN_ROLE.SUPER ? ADMIN_ROLE.SUPER : ADMIN_ROLE.STAFF;
    const permissions =
      role === ADMIN_ROLE.SUPER
        ? [...ALL_ADMIN_PERMISSIONS] // super implicitly holds everything
        : ((data.permissions as string[] | undefined) || []).filter((p): p is AdminPermission =>
            (ALL_ADMIN_PERMISSIONS as string[]).includes(p)
          );
    value = {
      role,
      permissions,
      accountStatus: (data.accountStatus as string) || 'active',
      exists: true,
    };
  }
  adminEntCache.set(adminUid, { value, expiresAt: now + TTL_MS });
  return value;
}

export function invalidateAdminEntitlements(adminUid: string) {
  adminEntCache.delete(adminUid);
}

/** True if this admin is a super admin (implicit full access + admin management). */
export async function isSuperAdmin(adminUid: string): Promise<boolean> {
  const ent = await getAdminEntitlements(adminUid);
  return ent.role === ADMIN_ROLE.SUPER;
}

/** True if this admin holds the given permission (super admins always do). */
export async function adminHasPermission(
  adminUid: string,
  permission: AdminPermission
): Promise<boolean> {
  const ent = await getAdminEntitlements(adminUid);
  if (ent.accountStatus !== 'active') return false;
  return ent.role === ADMIN_ROLE.SUPER || ent.permissions.includes(permission);
}
