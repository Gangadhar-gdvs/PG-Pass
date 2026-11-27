import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { verifyPortalSession } from '@/lib/server/security/portalAuth';
import { rentService } from '@/lib/server/services/rent.service';

export const POST = withErrorHandler(
  withRateLimit(
    async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
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

      // Authoritative verification of portal session & PIN before any mutation.
      const session = await verifyPortalSession(token, pin);

      // Service owns the UTR dedup + pending→verify transition.
      await rentService.claimPayment({
        rentRecordId,
        ownerId: session.ownerId,
        tenantId: session.tenantId,
        normalizedUtr: paymentReference.trim().toUpperCase(),
        proofPhotoId,
      });

      return NextResponse.json({
        success: true,
        message: 'Payment reference submitted successfully for owner verification',
        status: 'verify',
      });
    },
    // Raised so many residents behind one shared IP can submit payment claims
    // concurrently; UTR dedup (utr_claims) + portal auth prevent abuse per tenant.
    { tier: 'sensitive', key: 'ip', maxRequests: 40, windowSeconds: 60 }
  )
);
