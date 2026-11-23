import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/server/firebase-admin';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_DAYS } from '@/lib/constants/limits';

// POST: Exchange Firebase ID token for httpOnly session cookie
export const POST = withErrorHandler(
  withRateLimit(
    async (req: NextRequest) => {
      let body: { idToken?: string };
      try {
        body = await req.json();
      } catch {
        throw new AppError(400, 'Invalid JSON body');
      }

      const idToken = body.idToken;
      if (!idToken || typeof idToken !== 'string') {
        throw new AppError(400, 'Missing idToken');
      }

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
      const role = decodedToken.admin ? 'admin' : (decodedToken.role as string) || 'owner';

      if (role === 'owner') {
        const ownerDoc = await adminDb.collection('owners').doc(uid).get();
        if (ownerDoc.exists) {
          const ownerData = ownerDoc.data();
          if (ownerData?.accountStatus && ownerData.accountStatus !== 'active') {
            throw new AppError(403, 'Account is not active');
          }
        }
      }

      // 4. Create session cookie
      const expiresInMs = SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
      let sessionCookie: string;
      try {
        sessionCookie = await adminAuth.createSessionCookie(idToken, {
          expiresIn: expiresInMs,
        });
      } catch {
        throw new AppError(500, 'Failed to create session cookie');
      }

      const response = NextResponse.json({
        success: true,
        uid,
        role,
      });

      // 5. Set httpOnly session cookie
      response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: sessionCookie,
        maxAge: SESSION_MAX_AGE_DAYS * 24 * 60 * 60,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });

      return response;
    },
    { tier: 'sensitive', key: 'ip', maxRequests: 10, windowSeconds: 60 }
  )
);

// DELETE: Sign out / clear session cookie
export const DELETE = withErrorHandler(async () => {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
  return response;
});
