import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from './lib/constants/limits';
import { buildCsp } from './lib/server/security/csp';
import crypto from 'crypto';

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/beds',
  '/tenants',
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

  // 3. Inject nonce into request headers for downstream server components
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy-Report-Only', cspHeader);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // 4. Set CSP in Report-Only mode during staging/pilot soak
  response.headers.set('Content-Security-Policy-Report-Only', cspHeader);

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
