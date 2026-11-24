import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { rentService } from '@/lib/server/services/rent.service';

// Owner/staff records a partial or advance payment toward a rent record.
// When the accumulated amount covers the due amount, the record is marked paid
// and a receipt number is assigned (handled in the service transaction).
export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (
        req: NextRequest,
        ctx: { auth: AuthContext; params: Promise<{ id: string }> }
      ) => {
        const { id: recordId } = await ctx.params;
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;

        let body: { amountRupees?: number; amountPaise?: number; paymentReference?: string };
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }

        const amountPaise =
          body.amountPaise ??
          (typeof body.amountRupees === 'number'
            ? Math.round(body.amountRupees * 100)
            : undefined);

        if (!amountPaise || amountPaise <= 0) {
          throw new AppError(400, 'A positive payment amount is required');
        }

        const record = await rentService.recordPartialPayment(
          ownerId,
          recordId,
          ctx.auth.uid,
          { amountPaise, paymentReference: body.paymentReference }
        );

        return NextResponse.json({ success: true, record });
      },
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['owner', 'staff'] }
  )
);
