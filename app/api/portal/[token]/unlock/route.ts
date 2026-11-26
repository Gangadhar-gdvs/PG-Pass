import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/server/firebase-admin';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { verifyPortalSession } from '@/lib/server/security/portalAuth';

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
      if (!pin) {
        throw new AppError(400, 'Please enter a valid 4-digit PIN');
      }

      // Verify portal token & PIN with lockout enforcement
      const session = await verifyPortalSession(token, pin);

      // 1. Load tenant record
      const tenantSnap = await adminDb
        .collection('tenants')
        .doc(session.tenantId)
        .get();
      if (!tenantSnap.exists) {
        throw new AppError(404, 'Tenant record not found');
      }
      const tenantData = tenantSnap.data()!;

      // 2. Load PG / Owner information
      const ownerSnap = await adminDb
        .collection('owners')
        .doc(session.ownerId)
        .get();
      const ownerData = ownerSnap.exists ? ownerSnap.data() : {};

      // 3. Load Tenant Rent Records
      const rentRecordsSnap = await adminDb
        .collection('rent_records')
        .where('tenantId', '==', session.tenantId)
        .limit(12)
        .get();

      const rentRecords = rentRecordsSnap.docs.map((d) => {
        const r = d.data();
        return {
          id: d.id,
          period: r.period,
          roomNumber: r.roomNumber,
          bedLabel: r.bedLabel,
          // Explicit DTO: only what a resident needs to see (no internal ids/kinds).
          lineItems: ((r.lineItems || []) as Array<{ label?: string; amountPaise?: number }>).map((li) => ({
            label: li.label ?? '',
            amountPaise: li.amountPaise ?? 0,
          })),
          amountDuePaise: r.amountDuePaise,
          amountPaidPaise: r.amountPaidPaise || 0,
          status: r.status,
          dueDate: r.dueDate,
          paymentReference: r.paymentReference,
          claimedAt: r.claimedAt?.toDate()?.toISOString(),
          confirmedAt: r.confirmedAt?.toDate()?.toISOString(),
          receiptNumber: r.receiptNumber,
          proofPhotoId: r.proofPhotoId || null,
        };
      });

      // 4. Return ONLY whitelisted fields (never full phone or internal tokens)
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
          phone: ownerData?.phone || '',
        },
        rentRecords,
      };

      const response = NextResponse.json(sanitizedPayload);
      response.headers.set('Cache-Control', 'private, no-store');
      response.headers.set('Referrer-Policy', 'no-referrer');
      response.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return response;
    },
    // Raised IP limit so many residents behind ONE shared IP (college/PG wifi,
    // NAT) aren't collectively blocked on rent day. Real brute-force is still
    // stopped by the per-token PIN lockout in portalAuth (per tenant, not per IP).
    { tier: 'sensitive', key: 'ip', maxRequests: 60, windowSeconds: 60 }
  )
);
