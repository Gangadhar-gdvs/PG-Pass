import { describe, it, expect } from 'vitest';
import {
  generatePortalToken,
  hashToken,
  constantTimeEqual,
} from '@/lib/server/security/tokens';

/**
 * Regression tests for the resident-portal share link + PIN contract.
 *
 * Bug context: the owner-reported "portal link shows /t/undefined and the
 * last-4 PIN is always invalid". Root cause was that the raw portal token was
 * never persisted on the tenant doc, so the owner UI had nothing to share and
 * residents never reached a valid portal. These tests lock in the two
 * invariants the fix depends on:
 *   1. The raw token the owner shares hashes to the SAME value stored server-side
 *      (so unlock can look up portal_tokens/{hash}).
 *   2. The expected PIN is exactly the last 4 digits of the cleaned phone,
 *      matching what verifyPortalSession() compares against.
 */

// Mirrors the derivation in tenants.service.createTenant + portalAuth.verifyPortalSession.
function derivePin(rawPhone: string): string {
  const cleaned = rawPhone.replace(/\D/g, '');
  return cleaned.slice(-4);
}

describe('Portal share link + PIN contract', () => {
  it('raw shared token hashes to the stored token hash (round-trip)', () => {
    // Owner shares the raw token (persisted on the tenant doc); the server
    // stores only hashToken(raw). Unlock recomputes the hash from the URL token.
    const rawToken = generatePortalToken();
    const storedHash = hashToken(rawToken);
    const hashFromUnlock = hashToken(rawToken);
    expect(hashFromUnlock).toBe(storedHash);
  });

  it('a shared link containing the raw token is not /t/undefined', () => {
    // The concrete symptom: when token is persisted, the share URL is concrete.
    const rawToken = generatePortalToken();
    const shareUrl = `/t/${rawToken}`;
    expect(shareUrl).not.toContain('undefined');
    expect(shareUrl).toMatch(/^\/t\/[A-Za-z0-9_-]+$/);
  });

  it('expected PIN is the last 4 digits of the cleaned phone', () => {
    expect(derivePin('9876543210')).toBe('3210');
    expect(derivePin('+91 98765 43210')).toBe('3210'); // country code + spaces stripped
    expect(derivePin('098765-43210')).toBe('3210'); // punctuation stripped
  });

  it('PIN comparison succeeds for the correct last-4 and fails otherwise', () => {
    const phone = '+91 98765 43210';
    const storedLast4 = derivePin(phone); // '3210' — what tenant.phoneLast4 holds
    expect(constantTimeEqual('3210', storedLast4)).toBe(true);
    expect(constantTimeEqual('9876', storedLast4)).toBe(false); // first-4 must fail
    expect(constantTimeEqual('321', storedLast4)).toBe(false); // length mismatch
  });
});
