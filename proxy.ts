import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from './lib/constants/limits';
import { buildCsp } from './lib/server/security/csp';
import crypto from 'crypto';

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/beds',
  '/tenants',
  '/analytics',
  '/maintenance',
  '/expenses',
  '/deposits',
  '/rent',
  '/staff',
  '/billing',
  '/admin',
];

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // 1. Optimistic session check: redirect to /login if unauthenticated on protected routes
  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (isProtected && !sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Generate per-request CSP nonce
  const nonce = crypto.randomBytes(16).toString('base64');
  const cspHeader = buildCsp(nonce);

  // Enforce CSP in production; keep Report-Only in dev/staging so new sources
  // can be surfaced via violation reports before they start getting blocked.
  const cspHeaderName =
    process.env.NODE_ENV === 'production'
      ? 'Content-Security-Policy'
      : 'Content-Security-Policy-Report-Only';

  // 3. Inject nonce + the active CSP into request headers for downstream RSC
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set(cspHeaderName, cspHeader);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // 4. Set the response CSP header (enforcing in prod, report-only elsewhere)
  response.headers.set(cspHeaderName, cspHeader);

  return response;
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
