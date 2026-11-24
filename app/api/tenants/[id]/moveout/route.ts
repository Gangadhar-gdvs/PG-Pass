import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { tenantsService } from '@/lib/server/services/tenants.service';
import { STAFF_PERMISSIONS } from '@/lib/constants/permissions';

export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (
        req: NextRequest,
        ctx: { auth: AuthContext; params: Promise<{ id: string }> }
      ) => {
        const { id } = await ctx.params;
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;

        let body: {
          moveOutDate?: string;
          depositDeductionsPaise?: number;
          deductionReason?: string;
          refundPaise?: number;
        };

        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }

        if (!body.moveOutDate) {
          throw new AppError(400, 'moveOutDate is required');
        }

        const result = await tenantsService.moveOutTenant(id, ownerId, {
          moveOutDate: body.moveOutDate,
          depositDeductionsPaise: body.depositDeductionsPaise,
          deductionReason: body.deductionReason,
          refundPaise: body.refundPaise,
        });

        return NextResponse.json(result);
      },
      { tier: 'standard' }
    ),
    { roles: ['owner', 'staff'], permission: STAFF_PERMISSIONS.MANAGE_TENANTS }
  )
);
