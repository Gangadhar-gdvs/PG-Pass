import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { residentsService } from '@/lib/server/services/residents.service';
import { maintenanceService } from '@/lib/server/services/maintenance.service';

// Logged-in resident raises a maintenance issue for one of their tenancies.
export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (
        req: NextRequest,
        ctx: { auth: AuthContext; params: Promise<{ tenantId: string }> }
      ) => {
        const { tenantId } = await ctx.params;
        const tenant = await residentsService.assertOwnTenant(ctx.auth.uid, tenantId);

        let body: { category?: string; description?: string };
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }
        if (!body.description || body.description.trim().length < 3) {
          throw new AppError(400, 'Please describe the issue');
        }

        const ticket = await maintenanceService.createTicket({
          ownerId: tenant.ownerId,
          tenantId,
          category: body.category || 'other',
          description: body.description,
        });

        return NextResponse.json({ success: true, ticket }, { status: 201 });
      },
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['resident'] }
  )
);
