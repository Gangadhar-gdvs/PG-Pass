import 'server-only';
import crypto from 'crypto';

export function generatePortalToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

export function hashUtr(ownerId: string, utr: string): string {
  const normalizedUtr = utr.trim().toUpperCase();
  return crypto
    .createHash('sha256')
    .update(`${ownerId}_${normalizedUtr}`)
    .digest('hex');
}

export function hashSha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
