import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { adminUsersService } from '@/lib/server/services/adminUsers.service';
import { ADMIN_PERMISSIONS } from '@/lib/constants/permissions';
import { z } from 'zod';

const grantAdminSchema = z.object({
  targetUid: z.string().min(1, 'Target UID required'),
  reason: z.string().min(5, 'Reason for granting super admin is mandatory'),
});

export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (req: NextRequest, ctx: { auth: AuthContext }) => {
        let body;
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }

        const { targetUid, reason } = grantAdminSchema.parse(body);
        await adminUsersService.grantSuperAdmin(ctx.auth.uid, targetUid, reason);

        return NextResponse.json({
          success: true,
          message: `Super Admin role successfully granted to UID ${targetUid}`,
        });
      },
      { tier: 'sensitive', key: 'uid', maxRequests: 10, windowSeconds: 60 }
    ),
    // Granting super admin is itself super-only.
    { roles: ['admin'], adminPermission: ADMIN_PERMISSIONS.ADMINS_MANAGE }
  )
);
