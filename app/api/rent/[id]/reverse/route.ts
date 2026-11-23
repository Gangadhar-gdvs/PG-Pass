import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { rentService } from '@/lib/server/services/rent.service';

// Owner-only audited reversal of an accidental 'paid' record
export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (
        req: NextRequest,
        ctx: { auth: AuthContext; params: Promise<{ id: string }> }
      ) => {
        const { id: recordId } = await ctx.params;
        const ownerId = ctx.auth.uid; // Only the owner can reverse a payment

        let body: { reversalReason?: string };
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }

        if (!body.reversalReason) {
          throw new AppError(400, 'reversalReason is mandatory');
        }

        await rentService.reverseRent(
          ownerId,
          recordId,
          body.reversalReason,
          ctx.auth.uid
        );

        return NextResponse.json({ success: true, status: 'pending' });
      },
      { tier: 'standard' }
    ),
    { roles: ['owner'] }
  )
);
