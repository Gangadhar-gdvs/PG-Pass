import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '../firebase-admin';
import { AppError, RouteHandler } from './withErrorHandler';
import { SESSION_COOKIE_NAME, SESSION_ID_COOKIE_NAME } from '@/lib/constants/limits';
import { isSessionCurrent } from '../auth/sessionRegistry';
import { staffHasPermission, pgFeatureEnabled } from '../auth/entitlements';
import { StaffPermission, PgFeature } from '@/lib/constants/permissions';

export interface AuthContext {
  uid: string;
  role: 'owner' | 'staff' | 'admin' | 'tenant' | 'resident';
  ownerId?: string;
  email?: string;
}

export interface WithAuthOptions {
  roles?: Array<'owner' | 'staff' | 'admin' | 'tenant' | 'resident'>;
  // When set, a STAFF caller must hold this permission (owner/admin bypass).
  permission?: StaffPermission;
  // When set, the PG (owner scope) must have this feature enabled by the admin.
  // Applies to owner + staff callers; admins bypass.
  feature?: PgFeature;
}

// In-memory 60s cache for account status to eliminate redundant Firestore queries on every API request
interface AccountStatusCacheEntry {
  status: string;
  expiresAt: number;
}
const accountStatusCache = new Map<string, AccountStatusCacheEntry>();

async function getCachedAccountStatus(collectionName: 'owners' | 'staff', id: string): Promise<string> {
  const cacheKey = `${collectionName}:${id}`;
  const now = Date.now();
  const cached = accountStatusCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.status;
  }

  const snap = await adminDb.collection(collectionName).doc(id).get();
  const status = snap.exists ? (snap.data()?.accountStatus || 'active') : 'active';
  accountStatusCache.set(cacheKey, {
    status,
    expiresAt: now + 60_000, // 60s TTL
  });
  return status;
}

export function withAuth(
  handler: (req: NextRequest, ctx: any) => Promise<Response | NextResponse>,
  options: WithAuthOptions = {}
): RouteHandler {
  return async (req: NextRequest, ctx: any = {}) => {
    // 1. Extract session cookie
    const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!sessionCookie) {
      throw new AppError(401, 'Authentication required: missing session cookie');
    }

    // 2. High-speed cryptographic verification (<1ms in-memory verification without 1-2s network roundtrip)
    let decodedClaims;
    try {
      decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, false);
    } catch {
      throw new AppError(401, 'Invalid or expired session');
    }

    // 3. Check suspension claim
    if (decodedClaims.suspended === true) {
      throw new AppError(403, 'Account is suspended');
    }

    const uid = decodedClaims.uid;
    const isAdmin = decodedClaims.admin === true;
    const role: 'owner' | 'staff' | 'admin' | 'tenant' | 'resident' = isAdmin
      ? 'admin'
      : (decodedClaims.role as any) || 'owner';
    const ownerId = isAdmin
      ? undefined
      : role === 'owner'
      ? uid
      : (decodedClaims.ownerId as string | undefined);

    // 4. Role authorization check
    if (options.roles && options.roles.length > 0) {
      const allowed = options.roles.includes(role) || isAdmin;
      if (!allowed) {
        throw new AppError(
          403,
          `Access denied: required role ${options.roles.join(' or ')}`
        );
      }
    }

    // 5 + 6. Account-status and single-active-session checks. These are
    // independent Firestore reads, so run them CONCURRENTLY rather than in a
    // serial chain — on a cross-region serverless deploy each round-trip is
    // costly, and this roughly halves the per-request auth latency.
    // (Admins are exempt from both.)
    if (!isAdmin) {
      const sid = req.cookies.get(SESSION_ID_COOKIE_NAME)?.value;

      const statusCheck = (async () => {
        if (role === 'owner') {
          if ((await getCachedAccountStatus('owners', uid)) !== 'active') {
            throw new AppError(403, 'Owner account is not active');
          }
        } else if (role === 'staff') {
          if ((await getCachedAccountStatus('staff', uid)) !== 'active') {
            throw new AppError(403, 'Staff account is not active');
          }
          if (ownerId && (await getCachedAccountStatus('owners', ownerId)) !== 'active') {
            throw new AppError(403, 'Associated PG account is not active');
          }
        }
      })();

      const sessionCheck = (async () => {
        if (!(await isSessionCurrent(role, uid, sid))) {
          throw new AppError(401, 'This session was signed out on another device', 'SESSION_SUPERSEDED');
        }
      })();

      await Promise.all([statusCheck, sessionCheck]);
    }

    // 7. Per-staff permission check (owner/admin bypass). Enforced server-side
    // so a staff member can only perform actions their owner granted them.
    if (options.permission && !isAdmin && role === 'staff') {
      const ok = await staffHasPermission(uid, options.permission);
      if (!ok) {
        throw new AppError(403, 'You do not have permission to perform this action', 'PERMISSION_DENIED');
      }
    }

    // 8. Admin-controlled per-PG feature gate (owner + staff; admin bypasses).
    if (options.feature && !isAdmin) {
      const scopeOwnerId = role === 'owner' ? uid : ownerId;
      if (scopeOwnerId) {
        const enabled = await pgFeatureEnabled(scopeOwnerId, options.feature);
        if (!enabled) {
          throw new AppError(403, 'This feature is not enabled for your PG', 'FEATURE_DISABLED');
        }
      }
    }

    const authContext: AuthContext = {
      uid,
      role,
      ownerId,
      email: decodedClaims.email,
    };

    const enhancedCtx = {
      ...ctx,
      auth: authContext,
    };

    return handler(req, enhancedCtx);
  };
}
