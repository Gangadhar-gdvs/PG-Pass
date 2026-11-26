import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { connectOwnerGmail } from '@/lib/server/services/gmail.service';
import { constantTimeEqual } from '@/lib/server/security/tokens';
import { env } from '@/lib/env';

// Google redirects the OWNER'S browser here after consent. We verify the `state`
// against the httpOnly cookie set in /connect (CSRF), bind to the owner uid from
// that cookie (NOT from the URL), exchange the code, store the refresh token, and
// redirect back to Settings. The route is not withAuth-wrapped because Google is
// the referrer, but trust is established via the signed state cookie.
function back(appUrl: string, ok: boolean, msg?: string): NextResponse {
  const url = new URL('/settings', appUrl);
  url.searchParams.set('gmail', ok ? 'connected' : 'error');
  if (msg) url.searchParams.set('reason', msg);
  const res = NextResponse.redirect(url);
  res.cookies.delete('pgp_gmail_oauth');
  return res;
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const appUrl = env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') || '';
  const cookieState = req.cookies.get('pgp_gmail_oauth')?.value || '';

  if (url.searchParams.get('error')) {
    return back(appUrl, false, 'cancelled');
  }
  if (!code || !state || !cookieState || !constantTimeEqual(state, cookieState)) {
    return back(appUrl, false, 'invalid_state');
  }
  const ownerId = cookieState.split(':')[0];
  if (!ownerId) return back(appUrl, false, 'invalid_state');

  try {
    await connectOwnerGmail(ownerId, code);
    return back(appUrl, true);
  } catch {
    return back(appUrl, false, 'exchange_failed');
  }
});
