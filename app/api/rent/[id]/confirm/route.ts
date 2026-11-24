import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { rentService } from '@/lib/server/services/rent.service';
import { STAFF_PERMISSIONS } from '@/lib/constants/permissions';

export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (
        req: NextRequest,
        ctx: { auth: AuthContext; params: Promise<{ id: string }> }
      ) => {
        const { id: recordId } = await ctx.params;
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;

        let body: { paymentReference?: string } = {};
        try {
          body = await req.json();
        } catch {
          // Optional body
        }

        const confirmedRecord = await rentService.confirmRent(
          ownerId,
          recordId,
          ctx.auth.uid,
          body
        );

        return NextResponse.json({
          success: true,
          record: confirmedRecord,
        });
      },
      { tier: 'standard' }
    ),
    { roles: ['owner', 'staff'], permission: STAFF_PERMISSIONS.COLLECT_RENT }
  )
);
