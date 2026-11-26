import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { residentsService } from '@/lib/server/services/residents.service';
import { noticesService } from '@/lib/server/services/notices.service';

// Notices visible to this resident for the given tenancy (their PG + room).
export const GET = withErrorHandler(
  withAuth(
    async (_req: NextRequest, ctx: { auth: AuthContext; params: Promise<{ tenantId: string }> }) => {
      const { tenantId } = await ctx.params;
      const tenant = await residentsService.assertOwnTenant(ctx.auth.uid, tenantId);
      const notices = await noticesService.listForViewer(tenant.ownerId, 'residents', {
        roomNumber: tenant.roomNumber,
      });
      return NextResponse.json({ notices });
    },
    { roles: ['resident', 'tenant'] }
  )
);
