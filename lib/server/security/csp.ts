import 'server-only';
import { env } from '@/lib/env';

export function buildCsp(nonce: string): string {
  const b2Host = env.B2_S3_HOST || 'localhost:9000';
  const authDomain = env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'localhost';

  // Support both http and https for b2Host when developing locally
  const b2Origins = `https://${b2Host} http://${b2Host}`;
  const authOrigins = `https://${authDomain} http://${authDomain}`;

  // Allow 'unsafe-eval' in dev mode for Turbopack & React Fast Refresh
  const isDev = process.env.NODE_ENV !== 'production';
  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-eval' 'nonce-${nonce}' 'strict-dynamic' https://apis.google.com`
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://apis.google.com`;

  const directives = [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${b2Origins}`,
    `connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com ${b2Origins}`,
    `frame-src ${authOrigins} https://accounts.google.com`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ];

  return directives.join('; ');
}
