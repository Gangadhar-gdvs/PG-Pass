import 'server-only';
import { adminDb } from '../firebase-admin';
import { hashToken, constantTimeEqual } from './tokens';
import { AppError } from '../api/withErrorHandler';
import { recordEvent } from '../services/systemLogs.service';
import {
  PORTAL_PIN_MAX_ATTEMPTS,
  PORTAL_PIN_LOCKOUT_MINUTES,
} from '@/lib/constants/limits';
import { Timestamp } from 'firebase-admin/firestore';

export interface VerifiedPortalSession {
  tokenHash: string;
  ownerId: string;
  tenantId: string;
}

/**
 * Validates a resident's raw portal token and 4-digit PIN with brute-force lockout protections.
 */
export async function verifyPortalSession(
  token: string,
  pin: string
): Promise<VerifiedPortalSession> {
  if (!token || typeof token !== 'string') {
    throw new AppError(404, 'Portal link not found');
  }

  const cleanPin = pin?.trim();
  if (!cleanPin || cleanPin.length !== 4 || !/^\d{4}$/.test(cleanPin)) {
    throw new AppError(400, 'Please enter a valid 4-digit PIN');
  }

  const tokenHash = hashToken(token);
  const now = Date.now();

  // 1. Check portal_lockouts/{tokenHash}
  const lockoutRef = adminDb.collection('portal_lockouts').doc(tokenHash);
  const lockoutSnap = await lockoutRef.get();
  if (lockoutSnap.exists) {
    const lockoutData = lockoutSnap.data()!;
    const lockedUntilMs = lockoutData.lockedUntil?.toMillis() || 0;
    if (lockedUntilMs > now) {
      const remainingMinutes = Math.ceil((lockedUntilMs - now) / 60000);
      throw new AppError(
        429,
        `Too many failed attempts. Access is locked for ${remainingMinutes} more minute(s).`
      );
    }
  }

  // 2. Fetch portal_tokens/{tokenHash}
  const portalTokenRef = adminDb.collection('portal_tokens').doc(tokenHash);
  const portalTokenSnap = await portalTokenRef.get();

  if (!portalTokenSnap.exists) {
    throw new AppError(404, 'Portal link not found or has expired');
  }

  const tokenData = portalTokenSnap.data()!;

  // Check expiration, revocation, singleUse
  const expiresAtMs = tokenData.expiresAt?.toMillis() || 0;
  if (expiresAtMs > 0 && expiresAtMs < now) {
    throw new AppError(404, 'Portal link has expired');
  }
  if (tokenData.revokedAt) {
    throw new AppError(404, 'Portal link has been revoked');
  }
  if (tokenData.singleUse && tokenData.usedAt) {
    throw new AppError(404, 'Portal link has already been used');
  }

  // 3. Load tenant record
  const tenantRef = adminDb.collection('tenants').doc(tokenData.tenantId);
  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) {
    throw new AppError(404, 'Tenant record not found');
  }

  const tenantData = tenantSnap.data()!;
  if (tenantData.deletedAt || tenantData.accountStatus === 'suspended') {
    throw new AppError(403, 'Tenant account is inactive');
  }

  // Compute last 4 digits of phone
  const phoneCleaned = (tenantData.phone || '').replace(/\D/g, '');
  const expectedPin =
    tenantData.phoneLast4 || phoneCleaned.slice(-4) || '0000';

  // 4. Verify PIN in constant time
  const isPinValid = constantTimeEqual(cleanPin, expectedPin);

  if (!isPinValid) {
    // Handle failed attempt & lockout
    const currentAttempts = (lockoutSnap.data()?.attempts || 0) + 1;
    const willLock = currentAttempts >= PORTAL_PIN_MAX_ATTEMPTS;
    const lockedUntilDate = willLock
      ? new Date(now + PORTAL_PIN_LOCKOUT_MINUTES * 60 * 1000)
      : null;
    const expiresAtDate = new Date(
      now + PORTAL_PIN_LOCKOUT_MINUTES * 60 * 1000 * 2
    );

    await lockoutRef.set(
      {
        attempts: currentAttempts,
        lockedUntil: lockedUntilDate
          ? Timestamp.fromDate(lockedUntilDate)
          : null,
        expiresAt: Timestamp.fromDate(expiresAtDate),
      },
      { merge: true }
    );

    if (willLock) {
      await recordEvent({
        category: 'security',
        level: 'warn',
        message: `Portal PIN lockout after ${currentAttempts} failed attempts for tenant ${tokenData.tenantId}`,
        ownerId: tokenData.ownerId,
        targetId: tokenData.tenantId,
      });
      throw new AppError(
        429,
        `Too many failed attempts. Account locked for ${PORTAL_PIN_LOCKOUT_MINUTES} minutes.`
      );
    }

    const attemptsLeft = PORTAL_PIN_MAX_ATTEMPTS - currentAttempts;
    throw new AppError(
      401,
      `Incorrect PIN. ${attemptsLeft} attempt(s) remaining.`
    );
  }

  // 5. Successful PIN unlock -> clear lockouts
  if (lockoutSnap.exists) {
    await lockoutRef.delete();
  }

  return {
    tokenHash,
    ownerId: tokenData.ownerId,
    tenantId: tokenData.tenantId,
  };
}
