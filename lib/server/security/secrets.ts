import 'server-only';
import crypto from 'crypto';
import { env } from '@/lib/env';

/**
 * Symmetric encryption for secrets at rest (e.g. an owner's Gmail OAuth refresh
 * token stored in Firestore). AES-256-GCM with a key derived from
 * SECRETS_ENCRYPTION_KEY. Output format: base64(iv).base64(tag).base64(cipher).
 *
 * Throws if the key isn't configured — callers should only reach here when the
 * Gmail feature is enabled (which requires the key), so a missing key is a real
 * misconfiguration, not a silent no-op.
 */
function getKey(): Buffer {
  const raw = env.SECRETS_ENCRYPTION_KEY;
  if (!raw) throw new Error('SECRETS_ENCRYPTION_KEY is not configured');
  // Normalise any-length input to a 32-byte key.
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${enc.toString('base64')}`;
}

export function decryptSecret(payload: string): string {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = payload.split('.');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('Malformed encrypted secret');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

export function secretsEncryptionConfigured(): boolean {
  return Boolean(env.SECRETS_ENCRYPTION_KEY);
}
