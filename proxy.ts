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
  '/profile',
  '/utilities',
  '/inventory',
];

// Normalize a hostname: strip protocol, path, port, a leading `www.`, trailing
// slash and case. So `https://Admin-PGPass.vercel.app/`, `admin-pgpass.vercel.app:443`
// and `admin-pgpass.vercel.app` all compare equal — tolerant of how ADMIN_HOST
// was entered in the dashboard.
function normalizeHost(value: string | null | undefined): string {
  let h = (value || '').trim().toLowerCase();
  h = h.replace(/^https?:\/\//, ''); // strip protocol if the env included it
  h = h.split('/')[0]; // strip any path/trailing slash
  h = h.split(',')[0].trim(); // first of an x-forwarded-host list
  h = h.split(':')[0]; // strip port
  h = h.replace(/^www\./, ''); // treat www. and apex as the same site
  return h;
}

// Which host serves the ADMIN console. Set `ADMIN_HOST` in the admin deployment
// (e.g. `admin-pgpass.vercel.app`, or `admin.yourdomain.com` later). When the
// request's hostname matches, the site root (`/`) maps straight to the admin
// console and the normal app is hidden. When UNSET, admin stays at `/admin` on
// the single host (path-based) — so local dev + a single deploy still work.
const ADMIN_HOST = normalizeHost(process.env.ADMIN_HOST);

// Visited-before marker (1 year) — drives "first visit → landing, after → login".
const VISITED_COOKIE = 'pgp_seen';

function hostOf(request: NextRequest): string {
  // Behind a CDN/proxy (Vercel, etc.) the PUBLIC hostname arrives in
  // `x-forwarded-host`; the `host` header can be an internal platform host. Prefer
  // the forwarded host so ADMIN_HOST matching works on the real admin domain.
  return normalizeHost(request.headers.get('x-forwarded-host') || request.headers.get('host'));
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
    //
    // CRITICAL: never rewrite framework assets/data (`/_next/*`) or API routes.
    // Rewriting them to `/admin/_next/...` 404s the JS/RSC chunks, so the admin
    // page's client JS never boots and it's stuck on the "Checking admin
    // credentials…" spinner — i.e. the login form never appears. (The matcher
    // already skips `_next/static`, but RSC/data + other `_next/*` requests still
    // reach here and must be passed through untouched.)
    if (
      !pathname.startsWith('/admin') &&
      !pathname.startsWith('/api') &&
      !pathname.startsWith('/_next')
    ) {
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
