import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { maintenanceService } from '@/lib/server/services/maintenance.service';

const VALID_STATUS = ['open', 'in_progress', 'resolved'];

// Owner/staff transitions a maintenance ticket (open → in_progress → resolved).
export const PATCH = withErrorHandler(
  withAuth(
    withRateLimit(
      async (
        req: NextRequest,
        ctx: { auth: AuthContext; params: Promise<{ id: string }> }
      ) => {
        const { id } = await ctx.params;
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;

        let body: { status?: string; resolutionNote?: string };
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }

        if (!body.status || !VALID_STATUS.includes(body.status)) {
          throw new AppError(400, 'A valid status is required');
        }

        const ticket = await maintenanceService.updateStatus(
          id,
          ownerId,
          body.status as any,
          ctx.auth.uid,
          body.resolutionNote
        );

        return NextResponse.json({ success: true, ticket });
      },
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['owner', 'staff'] }
  )
);
