import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { buildConsentUrl, gmailConfigured } from '@/lib/server/services/gmail.service';
import crypto from 'crypto';

// Starts the OAuth flow: owner is redirected to Google's consent screen. A random
// `state` is set as a short-lived httpOnly cookie and echoed back by Google, so
// the callback can verify it (CSRF protection). The owner uid is bound into state.
export const GET = withErrorHandler(
  withAuth(
    async (_req: NextRequest, ctx: { auth: AuthContext }) => {
      if (!gmailConfigured()) {
        throw new AppError(400, 'Gmail sending is not enabled on this server.');
      }
      const nonce = crypto.randomBytes(16).toString('hex');
      const state = `${ctx.auth.uid}:${nonce}`;
      const url = buildConsentUrl(state);

      const res = NextResponse.redirect(url);
      res.cookies.set('pgp_gmail_oauth', `${ctx.auth.uid}:${nonce}`, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600, // 10 min
        path: '/api/owners/gmail',
      });
      return res;
    },
    { roles: ['owner'] }
  )
);
