import 'server-only';
import { env } from '@/lib/env';

export function buildCsp(nonce: string): string {
  const b2Host = env.B2_S3_HOST || 'localhost:9000';
  const authDomain = env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'localhost';

  // Support both http and https for b2Host and authDomain when developing locally
  const b2Origins = `https://${b2Host} http://${b2Host}`;
  const authOrigins = `https://${authDomain} http://${authDomain}`;

  // Allow essential scripts for Next.js hydration chunks, inline initialization,
  // and Firebase Google Sign-In / Auth SDKs.
  // We omit 'strict-dynamic' because modern browsers with 'strict-dynamic' ignore
  // host-based allowlists (like apis.google.com and gstatic.com) and block Next.js dynamic chunks.
  const scriptSources = [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    `'nonce-${nonce}'`,
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
