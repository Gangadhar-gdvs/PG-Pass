import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebase-admin';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { hashToken, constantTimeEqual } from '@/lib/server/security/tokens';
import {
  PORTAL_PIN_MAX_ATTEMPTS,
  PORTAL_PIN_LOCKOUT_MINUTES,
} from '@/lib/constants/limits';
import { Timestamp } from 'firebase-admin/firestore';

export const POST = withErrorHandler(
  withRateLimit(
    async (
      req: NextRequest,
      ctx: { params: Promise<{ token: string }> }
    ) => {
      const { token } = await ctx.params;
      if (!token || typeof token !== 'string') {
        throw new AppError(404, 'Portal link not found');
      }

      let body: { pin?: string };
      try {
        body = await req.json();
      } catch {
        throw new AppError(400, 'Invalid request payload');
      }

      const pin = body.pin?.trim();
      if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) {
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
        // Return 404 for unknown tokens to prevent probing
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
      const isPinValid = constantTimeEqual(pin, expectedPin);

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

      // 6. Load PG / Owner information
      const ownerSnap = await adminDb
        .collection('owners')
        .doc(tokenData.ownerId)
        .get();
      const ownerData = ownerSnap.exists ? ownerSnap.data() : {};

      // 7. Load Tenant Rent Records
      const rentRecordsSnap = await adminDb
        .collection('rent_records')
        .where('tenantId', '==', tokenData.tenantId)
        .limit(12)
        .get();

      const rentRecords = rentRecordsSnap.docs.map((d) => {
        const r = d.data();
        return {
          id: d.id,
          period: r.period,
          roomNumber: r.roomNumber,
          bedLabel: r.bedLabel,
          lineItems: r.lineItems || [],
          amountDuePaise: r.amountDuePaise,
          amountPaidPaise: r.amountPaidPaise || 0,
          status: r.status,
          dueDate: r.dueDate,
          paymentReference: r.paymentReference,
          claimedAt: r.claimedAt?.toDate()?.toISOString(),
          confirmedAt: r.confirmedAt?.toDate()?.toISOString(),
          receiptNumber: r.receiptNumber,
        };
      });

      // 8. Return ONLY whitelisted fields (never full phone or internal tokens)
      const sanitizedPayload = {
        tenant: {
          id: tenantSnap.id,
          name: tenantData.name,
          roomNumber: tenantData.roomNumber,
          bedLabel: tenantData.bedLabel,
          moveInDate: tenantData.moveInDate,
          depositPaidPaise: tenantData.depositPaidPaise || 0,
          securityDepositPaise: tenantData.securityDepositPaise || 0,
        },
        pg: {
          name: ownerData?.pgName || 'PG Accommodation',
          address: ownerData?.address || '',
          upiId: ownerData?.upiId || '',
          upiMerchantName: ownerData?.upiMerchantName || ownerData?.name || '',
        },
        rentRecords,
      };

      const response = NextResponse.json(sanitizedPayload);
      response.headers.set('Cache-Control', 'private, no-store');
      response.headers.set('Referrer-Policy', 'no-referrer');
      response.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return response;
    },
    { tier: 'sensitive', key: 'ip', maxRequests: 15, windowSeconds: 60 }
  )
);
