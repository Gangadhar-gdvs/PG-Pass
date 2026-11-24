import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '../firebase-admin';
import { AppError, RouteHandler } from './withErrorHandler';
import { SESSION_COOKIE_NAME } from '@/lib/constants/limits';

export interface AuthContext {
  uid: string;
  role: 'owner' | 'staff' | 'admin' | 'tenant' | 'resident';
  ownerId?: string;
  email?: string;
}

export interface WithAuthOptions {
  roles?: Array<'owner' | 'staff' | 'admin' | 'tenant' | 'resident'>;
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

    // 5. High-speed cached Firestore accountStatus verification
    if (!isAdmin) {
      if (role === 'owner') {
        const ownerStatus = await getCachedAccountStatus('owners', uid);
        if (ownerStatus !== 'active') {
          throw new AppError(403, 'Owner account is not active');
        }
      } else if (role === 'staff') {
        const staffStatus = await getCachedAccountStatus('staff', uid);
        if (staffStatus !== 'active') {
          throw new AppError(403, 'Staff account is not active');
        }

        // Check owning PG accountStatus
        if (ownerId) {
          const parentStatus = await getCachedAccountStatus('owners', ownerId);
          if (parentStatus !== 'active') {
            throw new AppError(403, 'Associated PG account is not active');
          }
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
