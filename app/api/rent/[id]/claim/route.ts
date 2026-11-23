import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebase-admin';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { hashToken, hashUtr, constantTimeEqual } from '@/lib/server/security/tokens';
import { Timestamp } from 'firebase-admin/firestore';

export const POST = withErrorHandler(
  withRateLimit(
    async (
      req: NextRequest,
      ctx: { params: Promise<{ id: string }> }
    ) => {
      const { id: rentRecordId } = await ctx.params;
      if (!rentRecordId) {
        throw new AppError(400, 'Missing rent record ID');
      }

      let body: {
        token?: string;
        pin?: string;
        paymentReference?: string;
        proofPhotoId?: string;
      };

      try {
        body = await req.json();
      } catch {
        throw new AppError(400, 'Invalid request body');
      }

      const { token, pin, paymentReference, proofPhotoId } = body;

      if (!token || !pin) {
        throw new AppError(401, 'Portal verification required');
      }

      if (!paymentReference || paymentReference.trim().length < 6) {
        throw new AppError(
          400,
          'Please provide a valid UPI Transaction ID / UTR reference number'
        );
      }

      const normalizedUtr = paymentReference.trim().toUpperCase();

      // 1. Verify portal token & PIN
      const tokenHash = hashToken(token);
      const portalTokenSnap = await adminDb
        .collection('portal_tokens')
        .doc(tokenHash)
        .get();

      if (!portalTokenSnap.exists) {
        throw new AppError(404, 'Portal session invalid or expired');
      }

      const tokenData = portalTokenSnap.data()!;
      const tenantSnap = await adminDb
        .collection('tenants')
        .doc(tokenData.tenantId)
        .get();

      if (!tenantSnap.exists) {
        throw new AppError(404, 'Tenant record not found');
      }

      const tenantData = tenantSnap.data()!;
      const phoneCleaned = (tenantData.phone || '').replace(/\D/g, '');
      const expectedPin =
        tenantData.phoneLast4 || phoneCleaned.slice(-4) || '0000';

      if (!constantTimeEqual(pin, expectedPin)) {
        throw new AppError(401, 'Invalid verification PIN');
      }

      const ownerId = tokenData.ownerId;
      const utrHashKey = hashUtr(ownerId, normalizedUtr);
      const utrClaimRef = adminDb.collection('utr_claims').doc(utrHashKey);
      const rentRecordRef = adminDb
        .collection('rent_records')
        .doc(rentRecordId);

      // 2. Atomic Firestore Transaction for UTR deduplication and status transition
      await adminDb.runTransaction(async (transaction) => {
        // Assert UTR is not already used
        const existingUtr = await transaction.get(utrClaimRef);
        if (existingUtr.exists) {
          throw new AppError(
            409,
            'This UPI UTR number has already been claimed for another payment. Please verify the 12-digit number.'
          );
        }

        // Fetch rent record
        const rentRecordDoc = await transaction.get(rentRecordRef);
        if (!rentRecordDoc.exists) {
          throw new AppError(404, 'Rent record not found');
        }

        const rentData = rentRecordDoc.data()!;

        // Confirm tenant owns this rent record
        if (rentData.tenantId !== tokenData.tenantId) {
          throw new AppError(403, 'Unauthorized rent record access');
        }

        if (rentData.status === 'paid') {
          throw new AppError(400, 'This rent record has already been marked as paid');
        }

        // Create UTR claim lock
        transaction.set(utrClaimRef, {
          ownerId,
          rentRecordId,
          tenantId: tokenData.tenantId,
          claimedAt: Timestamp.now(),
        });

        // Transition status pending -> verify
        transaction.update(rentRecordRef, {
          status: 'verify',
          paymentReference: normalizedUtr,
          proofPhotoId: proofPhotoId || null,
          claimedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      });

      return NextResponse.json({
        success: true,
        message: 'Payment reference submitted successfully for owner verification',
        status: 'verify',
      });
    },
    { tier: 'sensitive', key: 'ip', maxRequests: 10, windowSeconds: 60 }
  )
);
