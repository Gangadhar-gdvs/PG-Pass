import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { utilitiesService } from '@/lib/server/services/utilities.service';

// Charge the bill's shares onto residents' rent records (idempotent — a retry
// or double-tap never double-charges). No request body.
export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (_req: NextRequest, ctx: { auth: AuthContext; params: Promise<{ id: string }> }) => {
        const { id } = await ctx.params;
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;
        const { bill, result } = await utilitiesService.apply(ownerId, ctx.auth.uid, id);
        return NextResponse.json({ success: true, bill, result });
      },
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['owner'] }
  )
);
