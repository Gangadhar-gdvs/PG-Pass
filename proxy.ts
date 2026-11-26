import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from './lib/constants/limits';
import { buildCsp } from './lib/server/security/csp';
import crypto from 'crypto';

// NOTE: `/admin` is intentionally NOT listed. The admin console renders its own
// self-contained admin login form (claim-gated), so it must stay reachable when
// signed out — redirecting it to the owner `/login` is wrong (that was the
// "Master Admin link opens the normal login" bug).
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/beds',
  '/tenants',
  '/guests',
  '/analytics',
  '/maintenance',
  '/expenses',
  '/deposits',
  '/rent',
  '/staff',
  '/billing',
];

// Which host serves the ADMIN console. Set `ADMIN_HOST` in the admin deployment
// (e.g. `pgpass-admin.vercel.app` now, or `admin.yourdomain.com` later). When the
// request's hostname matches, the site root (`/`) maps straight to the admin
// console and the normal app is hidden. When UNSET, admin stays at `/admin` on
// the single host (path-based) — so local dev + a single deploy still work.
const ADMIN_HOST = process.env.ADMIN_HOST?.trim().toLowerCase() || '';

// Visited-before marker (1 year) — drives "first visit → landing, after → login".
const VISITED_COOKIE = 'pgp_seen';

function hostOf(request: NextRequest): string {
  return (request.headers.get('host') || '').split(':')[0].toLowerCase();
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const host = hostOf(request);
  const isAdminHost = ADMIN_HOST !== '' && host === ADMIN_HOST;

  // 0. HOSTNAME ROUTING (separate admin URL).
  if (isAdminHost) {
    // On the admin host, everything funnels to the admin console. The user's URL
    // bar stays on the admin host (rewrite, not redirect) and never shows /admin.
    if (!pathname.startsWith('/admin') && !pathname.startsWith('/api')) {
      const url = request.nextUrl.clone();
      url.pathname = pathname === '/' ? '/admin' : `/admin${pathname}`;
      return withSecurity(request, NextResponse.rewrite(url));
    }
  } else if (ADMIN_HOST !== '' && (pathname === '/admin' || pathname.startsWith('/admin/'))) {
    // Admin host IS configured but this request is on the MAIN host — the admin
    // console must only be reachable via the admin host. Send them to the app login.
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 1a. ROOT FLOW: first-ever visit → landing; returning → login (or dashboard if
  // already signed in). Only applies on the main (non-admin) host.
  if (pathname === '/' && !isAdminHost) {
    const seen = request.cookies.get(VISITED_COOKIE)?.value === '1';
    if (seen) {
      // Returning visitor → skip the landing page and go to login. The login
      // page forwards an already-authenticated session to the correct dashboard
      // by role (owner/staff → /dashboard, resident → /resident/home), so we
      // don't need to resolve the role here in edge middleware.
      return withSecurity(request, NextResponse.redirect(new URL('/login', request.url)));
    }
    // First visit → show the landing page, and remember they've been here so the
    // next visit skips straight to login/dashboard.
    const res = withSecurity(request, NextResponse.next());
    res.cookies.set(VISITED_COOKIE, '1', {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
    });
    return res;
    // (withSecurity returns a fresh next() response; setting the cookie on it here
    //  is correct — it's the object actually returned to the browser.)
  }

  // 1. Optimistic session check: redirect to /login if unauthenticated on protected routes
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (isProtected && !sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return withSecurity(request, NextResponse.next());
}

/**
 * Attach the per-request CSP (nonce) to a response. Applied to every response
 * path above so security headers are never skipped by the routing branches.
 * NOTE: for a plain `next()` we re-create it with the nonce injected into the
 * request headers so RSC can read `x-nonce`; redirects/rewrites just get the
 * response header.
 */
function withSecurity(request: NextRequest, response: NextResponse): NextResponse {
  const nonce = crypto.randomBytes(16).toString('base64');
  const cspHeader = buildCsp(nonce);

  // Enforce CSP in production; keep Report-Only in dev/staging so new sources
  // can be surfaced via violation reports before they start getting blocked.
  const isStagingOrDev =
    process.env.NODE_ENV !== 'production' ||
    process.env.NEXT_PUBLIC_APP_NAME?.toLowerCase().includes('staging') ||
    process.env.CSP_REPORT_ONLY === 'true';

  const cspHeaderName = isStagingOrDev
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';

  // Only a pass-through `next()` can carry request-header injection (so RSC reads
  // x-nonce). For redirects/rewrites we just set the response header.
  if (response.headers.get('location') || response.headers.get('x-middleware-rewrite')) {
    response.headers.set(cspHeaderName, cspHeader);
    return response;
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set(cspHeaderName, cspHeader);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set(cspHeaderName, cspHeader);
  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt
     * - public files (svg, png, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
