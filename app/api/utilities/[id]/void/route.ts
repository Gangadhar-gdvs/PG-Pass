import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthedContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { withValidation } from '@/lib/server/api/withValidation';
import { utilitiesService } from '@/lib/server/services/utilities.service';
import { voidUtilityBillSchema } from '@/lib/validation';

type Ctx = AuthedContext & { params: Promise<{ id: string }> };

// Void a bill: reverses applied charges (append-only adjustments where paid),
// soft-deletes the bill, writes an audit log. Requires a reason.
export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      withValidation<{ reason: string }, Ctx>(voidUtilityBillSchema)(async (_req, ctx) => {
        const { id } = await ctx.params;
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;
        const { bill, result } = await utilitiesService.void(ownerId, ctx.auth.uid, id, ctx.data.reason);
        return NextResponse.json({ success: true, bill, result });
      }),
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['owner'] }
  )
);
