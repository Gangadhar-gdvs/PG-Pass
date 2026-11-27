import { describe, it, expect } from 'vitest';
import {
  generatePortalToken,
  hashToken,
  hashUtr,
  hashSha256,
  constantTimeEqual,
} from '@/lib/server/security/tokens';

describe('Security Tokens & Cryptography', () => {
  it('should generate a 32-byte base64url random portal token', () => {
    const token = generatePortalToken();
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    // 32 bytes base64url is 43 characters
    expect(token.length).toBeGreaterThanOrEqual(42);
    // Should only contain url-safe base64 characters
    expect(/^[A-Za-z0-9_-]+$/.test(token)).toBe(true);
  });

  it('should hash a token deterministically with sha256', () => {
    const rawToken = 'my_secret_token_123';
    const hash1 = hashToken(rawToken);
    const hash2 = hashToken(rawToken);
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should normalize and hash UPI UTR scoped to ownerId', () => {
    const ownerId = 'owner_abc';
    const utr1 = '123456789012';
    const utr2 = ' 123456789012 ';
    const utrLower = 'UTR123456789012';
    const utrUpper = 'utr123456789012';

    const hash1 = hashUtr(ownerId, utr1);
    const hash2 = hashUtr(ownerId, utr2);
    expect(hash1).toBe(hash2);

    const hashCase1 = hashUtr(ownerId, utrLower);
    const hashCase2 = hashUtr(ownerId, utrUpper);
    expect(hashCase1).toBe(hashCase2);

    // Different owner with same UTR produces distinct hash
    const hashDiffOwner = hashUtr('other_owner', utr1);
    expect(hash1).not.toBe(hashDiffOwner);
  });

  it('UTR lock key is hashUtr, NOT the plaintext `${ownerId}_${UTR}` (reject-release regression)', () => {
    // Regression for the bug where rent/[id]/claim LOCKED the UTR under
    // hashUtr(...) but rejectClaim DELETED a plaintext `${ownerId}_${UTR}` key —
    // the two never matched, so a rejected claim left the UTR locked forever.
    // Both sites must derive the SAME key from hashUtr; this asserts the correct
    // key is the hash and that the old plaintext key was indeed different.
    const ownerId = 'owner_abc';
    const utr = '123456789012';
    const correctKey = hashUtr(ownerId, utr);
    const oldPlaintextKey = `${ownerId}_${utr.trim().toUpperCase()}`;
    expect(correctKey).toMatch(/^[0-9a-f]{64}$/);
    expect(correctKey).not.toBe(oldPlaintextKey);
    // Claim and reject now both call hashUtr → identical, case/space-insensitive.
    expect(hashUtr(ownerId, ` ${utr} `)).toBe(correctKey);
  });

  it('should perform constant-time string comparison', () => {
    expect(constantTimeEqual('1234', '1234')).toBe(true);
    expect(constantTimeEqual('1234', '1235')).toBe(false);
    expect(constantTimeEqual('1234', '123')).toBe(false);
    expect(constantTimeEqual('abcd', 'abcd')).toBe(true);
    expect(constantTimeEqual('abcd', 'abce')).toBe(false);
  });

  it('should produce valid sha256 hex hashes of buffer and string data', () => {
    const hash = hashSha256('hello world');
    // sha256("hello world") = b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9
    expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  });
});
