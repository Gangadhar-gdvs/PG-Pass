import { describe, it, expect, beforeAll } from 'vitest';

/**
 * Guards the at-rest secret encryption used for owner Gmail refresh tokens.
 * AES-256-GCM: a ciphertext must decrypt back to the original, must be
 * non-deterministic (random IV), and must fail (throw) if tampered with.
 */

// The key must be present before importing env-dependent code.
beforeAll(() => {
  process.env.SECRETS_ENCRYPTION_KEY = 'test-secret-key-at-least-32-chars-long!!';
});

describe('secret encryption (AES-256-GCM)', () => {
  it('round-trips plaintext', async () => {
    const { encryptSecret, decryptSecret } = await import('@/lib/server/security/secrets');
    const secret = '1//refresh-token-abc.DEF_123';
    const enc = encryptSecret(secret);
    expect(enc).not.toContain(secret); // actually encrypted
    expect(decryptSecret(enc)).toBe(secret);
  });

  it('is non-deterministic (unique IV per call)', async () => {
    const { encryptSecret } = await import('@/lib/server/security/secrets');
    expect(encryptSecret('same')).not.toBe(encryptSecret('same'));
  });

  it('rejects a tampered ciphertext (auth tag fails)', async () => {
    const { encryptSecret, decryptSecret } = await import('@/lib/server/security/secrets');
    const enc = encryptSecret('sensitive');
    const [iv, tag, data] = enc.split('.');
    // flip a byte in the ciphertext
    const tampered = `${iv}.${tag}.${Buffer.from('xx' + data).toString('base64')}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it('rejects a malformed payload', async () => {
    const { decryptSecret } = await import('@/lib/server/security/secrets');
    expect(() => decryptSecret('not-a-valid-payload')).toThrow();
  });
});
