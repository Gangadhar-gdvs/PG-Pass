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
export const POST = withErrorHandler(
  withRateLimit(
    async (req: NextRequest) => {
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

      // 1. Verify Firebase ID token
      let decodedToken;
      try {
        decodedToken = await adminAuth.verifyIdToken(idToken, true);
      } catch {
        throw new AppError(401, 'Invalid or expired ID token');
      }

      // 2. Check suspension
      if (decodedToken.suspended === true) {
        throw new AppError(403, 'Account is suspended');
      }

      // 3. Verify accountStatus in Firestore if owner
      const uid = decodedToken.uid;
      const role: Role = decodedToken.admin ? 'admin' : ((decodedToken.role as Role) || 'owner');

      if (role === 'owner') {
        const ownerDoc = await adminDb.collection('owners').doc(uid).get();
        if (ownerDoc.exists) {
          const ownerData = ownerDoc.data();
          if (ownerData?.accountStatus && ownerData.accountStatus !== 'active') {
            throw new AppError(403, 'Account is not active');
          }
        }
      }

      // 4. Single-active-session arbitration (admins exempt).
      const existingSid = req.cookies.get(SESSION_ID_COOKIE_NAME)?.value;
      const activeSid = await getActiveSessionId(role, uid);

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

      // 6. Create the Firebase session cookie
      const expiresInMs = SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
      let sessionCookie: string;
      try {
        sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: expiresInMs });
      } catch {
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
    },
    { tier: 'sensitive', key: 'ip', maxRequests: 10, windowSeconds: 60 }
  )
);

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
