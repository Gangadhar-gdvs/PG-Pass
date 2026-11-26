import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { depositsService } from '@/lib/server/services/deposits.service';
import { STAFF_PERMISSIONS } from '@/lib/constants/permissions';

// Owner marks a pending deposit refund as actually paid out to the tenant.
export const PATCH = withErrorHandler(
  withAuth(
    withRateLimit(
      async (
        req: NextRequest,
        ctx: { auth: AuthContext; params: Promise<{ depositId: string }> }
      ) => {
        const { depositId } = await ctx.params;
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;

        let body: { reference?: string } = {};
        try {
          body = await req.json();
        } catch {
          /* reference is optional */
        }

        const entry = await depositsService.markRefundIssued(
          ownerId,
          depositId,
          ctx.auth.uid,
          body.reference
        );
        return NextResponse.json({ success: true, entry });
      },
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['owner', 'staff'], permission: STAFF_PERMISSIONS.MANAGE_TENANTS }
  )
);
