import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '../firebase-admin';
import { AppError, RouteHandler } from './withErrorHandler';
import { SESSION_COOKIE_NAME } from '@/lib/constants/limits';

export interface AuthContext {
  uid: string;
  role: 'owner' | 'staff' | 'admin' | 'tenant';
  ownerId?: string;
  email?: string;
}

export interface WithAuthOptions {
  roles?: Array<'owner' | 'staff' | 'admin' | 'tenant'>;
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

    // 2. Authoritative verification with revocation check
    let decodedClaims;
    try {
      decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    } catch {
      throw new AppError(401, 'Invalid or expired session');
    }

    // 3. Check suspension claim
    if (decodedClaims.suspended === true) {
      throw new AppError(403, 'Account is suspended');
    }

    const uid = decodedClaims.uid;
    const isAdmin = decodedClaims.admin === true;
    const role: 'owner' | 'staff' | 'admin' | 'tenant' = isAdmin
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

    // 5. Authoritative Firestore accountStatus verification
    if (!isAdmin) {
      if (role === 'owner') {
        const ownerSnap = await adminDb.collection('owners').doc(uid).get();
        if (ownerSnap.exists) {
          const ownerData = ownerSnap.data();
          if (ownerData?.accountStatus && ownerData.accountStatus !== 'active') {
            throw new AppError(403, 'Owner account is not active');
          }
        }
      } else if (role === 'staff') {
        const staffSnap = await adminDb.collection('staff').doc(uid).get();
        if (staffSnap.exists) {
          const staffData = staffSnap.data();
          if (staffData?.accountStatus && staffData.accountStatus !== 'active') {
            throw new AppError(403, 'Staff account is not active');
          }
        }

        // Check owning PG accountStatus
        if (ownerId) {
          const parentOwnerSnap = await adminDb
            .collection('owners')
            .doc(ownerId)
            .get();
          if (parentOwnerSnap.exists) {
            const parentData = parentOwnerSnap.data();
            if (
              parentData?.accountStatus &&
              parentData.accountStatus !== 'active'
            ) {
              throw new AppError(403, 'Associated PG account is not active');
            }
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
