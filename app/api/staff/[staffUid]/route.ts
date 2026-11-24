import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { staffService } from '@/lib/server/services/staff.service';
import { ACCOUNT_STATUS } from '@/lib/constants/status';
import { z } from 'zod';

const updateStaffSchema = z.object({
  status: z.enum([ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.SUSPENDED]),
});

export const PATCH = withErrorHandler(
  withAuth(
    withRateLimit(
      async (
        req: NextRequest,
        ctx: { auth: AuthContext; params: Promise<{ staffUid: string }> }
      ) => {
        const { staffUid } = await ctx.params;
        const ownerId = ctx.auth.uid;

        let body;
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }

        const validated = updateStaffSchema.parse(body);
        const updated = await staffService.updateStaffStatus(
          staffUid,
          ownerId,
          validated.status,
          ctx.auth.uid
        );

        return NextResponse.json(updated);
      },
      { tier: 'standard' }
    ),
    { roles: ['owner'] }
  )
);

// PUT: owner sets this staff member's granted permissions (independent per staff).
export const PUT = withErrorHandler(
  withAuth(
    withRateLimit(
      async (
        req: NextRequest,
        ctx: { auth: AuthContext; params: Promise<{ staffUid: string }> }
      ) => {
        const { staffUid } = await ctx.params;
        const ownerId = ctx.auth.uid;

        let body: { permissions?: string[] };
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }
        if (!Array.isArray(body.permissions)) {
          throw new AppError(400, 'permissions must be an array');
        }

        const updated = await staffService.updatePermissions(
          staffUid,
          ownerId,
          body.permissions,
          ctx.auth.uid
        );
        return NextResponse.json(updated);
      },
      { tier: 'standard' }
    ),
    { roles: ['owner'] }
  )
);

export const DELETE = withErrorHandler(
  withAuth(
    withRateLimit(
      async (
        req: NextRequest,
        ctx: { auth: AuthContext; params: Promise<{ staffUid: string }> }
      ) => {
        const { staffUid } = await ctx.params;
        const ownerId = ctx.auth.uid;

        await staffService.revokeStaff(staffUid, ownerId, ctx.auth.uid);
        return NextResponse.json({ success: true, message: 'Staff access revoked' });
      },
      { tier: 'standard' }
    ),
    { roles: ['owner'] }
  )
);
