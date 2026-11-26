import 'server-only';
import { cookies } from 'next/headers';
import { adminAuth } from '../firebase-admin';
import { SESSION_COOKIE_NAME, SESSION_ID_COOKIE_NAME } from '@/lib/constants/limits';
import { isSessionCurrent } from './sessionRegistry';
import { getAdminEntitlements } from './entitlements';
import { AdminRole, AdminPermission } from '@/lib/constants/permissions';

export interface ServerUser {
  uid: string;
  role: 'owner' | 'staff' | 'admin' | 'tenant' | 'resident';
  ownerId?: string;
  email?: string;
  phoneNumber?: string;
  adminRole?: AdminRole;
  adminPermissions?: AdminPermission[];
}

/**
 * Resolve the signed-in user from the `__session` cookie inside a Server
 * Component / layout / route (anything with access to `next/headers`).
 *
 * This lets the server gate protected pages and hand `uid`/`ownerId` to the
 * client on the very first render — removing the client-side
 * `onAuthStateChanged` round-trip that previously blocked every owner page
 * behind a full-screen spinner before any data fetch could start.
 *
 * Returns `null` when there is no cookie or it fails verification; callers
 * decide whether to `redirect('/login')`.
 */
export async function getServerUser(): Promise<ServerUser | null> {
  const store = await cookies();
  const sessionCookie = store.get(SESSION_COOKIE_NAME)?.value;
  if (!sessionCookie) return null;

  try {
    // Same verification the API layer uses (no network round-trip).
    const claims = await adminAuth.verifySessionCookie(sessionCookie, false);
    if (claims.suspended === true) return null;

    const isAdmin = claims.admin === true;
    const role: ServerUser['role'] = isAdmin
      ? 'admin'
      : ((claims.role as ServerUser['role']) || 'owner');
    const ownerId = isAdmin
      ? undefined
      : role === 'owner'
        ? claims.uid
        : (claims.ownerId as string | undefined);

    // Single-active-session: a page load from a device whose session was taken
    // over on another device is treated as signed-out (callers redirect).
    if (!isAdmin) {
      const sid = store.get(SESSION_ID_COOKIE_NAME)?.value;
      const current = await isSessionCurrent(role, claims.uid, sid);
      if (!current) return null;
    }

    // Admin tier + permissions (for server-gating the admin console nav/pages).
    let adminRole: AdminRole | undefined;
    let adminPermissions: AdminPermission[] | undefined;
    if (isAdmin) {
      const ent = await getAdminEntitlements(claims.uid);
      if (ent.accountStatus !== 'active') return null; // suspended admin = signed out
      adminRole = ent.role;
      adminPermissions = ent.permissions;
    }

    return {
      uid: claims.uid,
      role,
      ownerId,
      email: claims.email,
      phoneNumber: claims.phone_number,
      adminRole,
      adminPermissions,
    };
  } catch {
    return null;
  }
}
