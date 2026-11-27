import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { depositsService } from '@/lib/server/services/deposits.service';
import { depositEntrySchema } from '@/lib/validation';
import { STAFF_PERMISSIONS } from '@/lib/constants/permissions';

export const GET = withErrorHandler(
  withAuth(
    async (
      req: NextRequest,
      ctx: { auth: AuthContext; params: Promise<{ tenantId: string }> }
    ) => {
      const { tenantId } = await ctx.params;
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;

      const entries = await depositsService.listDeposits(ownerId, tenantId);
      return NextResponse.json({ entries });
    },
    { roles: ['owner', 'staff'], anyPermission: [STAFF_PERMISSIONS.MANAGE_TENANTS, STAFF_PERMISSIONS.COLLECT_RENT] }
  )
);

export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (
        req: NextRequest,
        ctx: { auth: AuthContext; params: Promise<{ tenantId: string }> }
      ) => {
        const { tenantId } = await ctx.params;
        let body;
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }

        const validated = depositEntrySchema.parse(body);
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;

        const newEntry = await depositsService.recordEntry(
          ownerId,
          tenantId,
          {
            ...validated,
            recordedBy: ctx.auth.uid,
          }
        );

        return NextResponse.json(newEntry, { status: 201 });
      },
      { tier: 'standard' }
    ),
    { roles: ['owner', 'staff'], permission: STAFF_PERMISSIONS.MANAGE_TENANTS }
  )
);
