import 'server-only';
import { env } from '@/lib/env';

export function buildCsp(_nonce: string): string {
  const b2Host = env.B2_S3_HOST || 'localhost:9000';
  const authDomain = env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'localhost';

  // Support both http and https for b2Host and authDomain when developing locally
  const b2Origins = `https://${b2Host} http://${b2Host}`;
  const authOrigins = `https://${authDomain} http://${authDomain}`;

  // Allow essential scripts for Next.js hydration chunks, inline initialization,
  // and Firebase Google Sign-In / Auth SDKs.
  //
  // IMPORTANT: The nonce is intentionally NOT included in script-src/script-src-elem.
  // Per the CSP spec, when a nonce-* value is present, browsers IGNORE 'unsafe-inline'
  // entirely — meaning any inline script without the matching nonce attribute is blocked.
  // Firebase Auth injects its own inline scripts that cannot be nonce-tagged by us,
  // so including the nonce here causes CSP violations on every Google sign-in.
  // The nonce is still generated and passed via the x-nonce request header for
  // Next.js RSC use, but it must stay out of the CSP header.
  //
  // We omit 'strict-dynamic' because modern browsers with 'strict-dynamic' ignore
  // host-based allowlists (like apis.google.com and gstatic.com) and block Next.js dynamic chunks.
  const scriptSources = [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    'https://apis.google.com',
    'https://www.gstatic.com',
    'https://*.googleapis.com',
    'https://*.firebaseapp.com',
    'https://accounts.google.com',
    'https://www.google.com',
  ].join(' ');

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSources}`,
    `script-src-elem ${scriptSources}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    `img-src 'self' data: blob: ${b2Origins} https://*.googleusercontent.com https://lh3.googleusercontent.com https://www.gstatic.com`,
    `connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://accounts.google.com https://apis.google.com ${authOrigins} ${b2Origins}`,
    `frame-src 'self' ${authOrigins} https://accounts.google.com https://*.firebaseapp.com https://apis.google.com`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];

  return directives.join('; ');
}
