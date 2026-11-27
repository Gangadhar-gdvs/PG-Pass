import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { adminAuth, adminDb } from '@/lib/server/firebase-admin';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import {
  SESSION_COOKIE_NAME,
  SESSION_ID_COOKIE_NAME,
  SESSION_MAX_AGE_DAYS,
} from '@/lib/constants/limits';
import {
  getActiveSessionId,
  setActiveSession,
  clearActiveSession,
  isSessionCurrent,
} from '@/lib/server/auth/sessionRegistry';

type Role = 'owner' | 'staff' | 'admin' | 'tenant' | 'resident';

// POST: Exchange Firebase ID token for httpOnly session cookie.
//
// Body:
//   { idToken, mode?: 'login' | 'refresh', takeover?: boolean, device?: string }
//
// - mode 'login'   → explicit sign-in. If another device already holds the
//                    active session and `takeover` is not set, responds 409
//                    so the client can ask the user to confirm kicking it.
//                    With `takeover: true` it registers this device and the
//                    other device is superseded (logged out) on its next call.
// - mode 'refresh' → background re-sync (useAuth). Never takes over: if this
//                    device was already superseded it responds 401 so the tab
//                    logs itself out instead of silently reclaiming the session.
// The handler itself; wrapped below with a mode-specific rate limit.
const postSession = async (req: NextRequest) => {
      let body: { idToken?: string; mode?: 'login' | 'refresh'; takeover?: boolean; device?: string };
      try {
        body = await req.json();
      } catch {
        throw new AppError(400, 'Invalid JSON body');
      }

      const idToken = body.idToken;
      if (!idToken || typeof idToken !== 'string') {
        throw new AppError(400, 'Missing idToken');
      }
      const mode = body.mode === 'login' ? 'login' : 'refresh';

      // 1. Verify Firebase ID token. `checkRevoked = false` avoids an extra
      // network round-trip to the Firebase Auth backend: at login the client SDK
      // minted this token seconds ago, so a revocation check adds latency with no
      // real benefit. Revocation is still enforced at logout (we revoke refresh
      // tokens) and on every protected request via the session cookie.
      let decodedToken;
      try {
        decodedToken = await adminAuth.verifyIdToken(idToken, false);
      } catch {
        throw new AppError(401, 'Invalid or expired ID token');
      }

      // 2. Check suspension
      if (decodedToken.suspended === true) {
        throw new AppError(403, 'Account is suspended');
      }

      const uid = decodedToken.uid;
      const role: Role = decodedToken.admin ? 'admin' : ((decodedToken.role as Role) || 'owner');
      const existingSid = req.cookies.get(SESSION_ID_COOKIE_NAME)?.value;
      const expiresInMs = SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

      // 3 + 4 + 6. The owner account-status read, the active-session lookup, and
      // minting the session cookie are all independent — run them CONCURRENTLY so
      // we pay one cross-region round-trip instead of three in series. Each result
      // is validated below in its original order.
      const [ownerDoc, activeSid, sessionCookie] = await Promise.all([
        role === 'owner'
          ? adminDb.collection('owners').doc(uid).get()
          : Promise.resolve(null),
        getActiveSessionId(role, uid),
        adminAuth.createSessionCookie(idToken, { expiresIn: expiresInMs }).catch(() => null),
      ]);

      // 3. Verify accountStatus in Firestore if owner.
      if (ownerDoc && ownerDoc.exists) {
        const ownerData = ownerDoc.data();
        if (ownerData?.accountStatus && ownerData.accountStatus !== 'active') {
          throw new AppError(403, 'Account is not active');
        }
      }

      if (mode === 'refresh') {
        // Background re-sync must not reclaim a session taken over elsewhere, and
        // must never MINT a new session. A refresh with no existing session-id
        // cookie is not a legitimate active device (e.g. a second tab racing the
        // login tab) — reject it so it can't clobber the real login's sid.
        if (!existingSid) {
          throw new AppError(409, 'No active session to refresh', 'SESSION_SUPERSEDED');
        }
        const current = await isSessionCurrent(role, uid, existingSid);
        if (!current) {
          throw new AppError(409, 'This session was signed out on another device', 'SESSION_SUPERSEDED');
        }
      } else {
        // Explicit login. If a DIFFERENT device already holds the session and
        // the user hasn't confirmed takeover, ask first.
        if (activeSid && activeSid !== existingSid && !body.takeover) {
          return NextResponse.json(
            {
              error: 'Already signed in on another device',
              code: 'ACTIVE_SESSION_EXISTS',
            },
            { status: 409 }
          );
        }
      }

      // 5. Decide this device's session id.
      // - refresh: keep the existing (already-validated) id (guaranteed present).
      // - login:   mint a fresh id (so the previous device is superseded).
      const sessionId = mode === 'refresh' ? (existingSid as string) : randomUUID();

      // 6. The session cookie was minted in the parallel batch above.
      if (!sessionCookie) {
        throw new AppError(500, 'Failed to create session cookie');
      }

      // 7. Register this device as the active session (login or first refresh).
      if (mode === 'login' || !activeSid) {
        await setActiveSession(role, uid, sessionId, body.device);
      }

      const response = NextResponse.json({ success: true, uid, role });

      const maxAge = SESSION_MAX_AGE_DAYS * 24 * 60 * 60;
      const cookieBase = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        path: '/',
        maxAge,
      };
      response.cookies.set({ name: SESSION_COOKIE_NAME, value: sessionCookie, ...cookieBase });
      response.cookies.set({ name: SESSION_ID_COOKIE_NAME, value: sessionId, ...cookieBase });

      return response;
};

// Rate limits (R-A7). Explicit sign-ins keep the strict, Firestore-backed
// 10/min-per-IP budget (consistent across server instances). Background
// refreshes (`useAuth`, one per fresh page) get their OWN budget so a few open
// tabs on shared PG Wi-Fi / carrier NAT can't lock real sign-ins out. Refresh
// can't mint a session without a valid ID token AND this device's current
// session id, so a looser per-instance limit is safe there.
const loginLimited = withRateLimit(postSession, { tier: 'sensitive', key: 'ip', maxRequests: 10, windowSeconds: 60 });
const refreshLimited = withRateLimit(postSession, {
  tier: 'standard',
  key: 'ip',
  maxRequests: 60,
  windowSeconds: 60,
  bucket: 'refresh',
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  // Peek at the mode on a clone so the handler can still read the body. The
  // handler treats anything but 'login' as a refresh; unreadable bodies take the
  // strict bucket (the handler then rejects them with 400).
  let mode: string | undefined;
  try {
    mode = ((await req.clone().json()) as { mode?: string } | null)?.mode;
  } catch {
    mode = 'login';
  }
  return mode === 'login' ? loginLimited(req, undefined) : refreshLimited(req, undefined);
});

// DELETE: Sign out. Clears cookies on THIS device and, by revoking the active
// session registration + Firebase refresh tokens, signs the account out of all
// other devices too (Jio/Hotstar "log out everywhere").
export const DELETE = withErrorHandler(async (req: NextRequest) => {
  // Best-effort: identify the user so we can revoke everywhere.
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionCookie) {
    try {
      const claims = await adminAuth.verifySessionCookie(sessionCookie, false);
      const role: Role = claims.admin ? 'admin' : ((claims.role as Role) || 'owner');
      await clearActiveSession(role, claims.uid);
      await adminAuth.revokeRefreshTokens(claims.uid).catch(() => {});
    } catch {
      // Expired/invalid cookie — nothing to revoke; still clear local cookies.
    }
  }

  const response = NextResponse.json({ success: true });
  const clear = {
    value: '',
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
  response.cookies.set({ name: SESSION_COOKIE_NAME, ...clear });
  response.cookies.set({ name: SESSION_ID_COOKIE_NAME, ...clear });
  return response;
});
