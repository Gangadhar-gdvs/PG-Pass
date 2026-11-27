import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { adminAccountsService } from '@/lib/server/services/adminAccounts.service';
import { ACCOUNT_STATUS } from '@/lib/constants/status';
import { z } from 'zod';
import { ADMIN_PERMISSIONS } from '@/lib/constants/permissions';

const accountActionSchema = z.object({
  targetType: z.enum(['owner', 'staff', 'tenant']),
  targetId: z.string().min(1),
  action: z.enum(['suspend', 'reactivate']),
  reason: z.string().min(3, 'A clear reason is required'),
});

// POST — full form: suspend/reactivate an owner/staff/tenant with a reason.
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

        const { targetType, targetId, action, reason } = accountActionSchema.parse(body);
        const newStatus = await adminAccountsService.setAccountStatus({
          targetType,
          targetId,
          suspend: action === 'suspend',
          reason,
          actorUid: ctx.auth.uid,
        });

        return NextResponse.json({
          success: true,
          message: `Successfully updated ${targetType} status to ${newStatus}`,
        });
      },
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['admin'], adminPermission: ADMIN_PERMISSIONS.PLATFORM_VIEW }
  )
);

// PATCH — quick owner suspend/reactivate from the PG detail panel.
// Body: { ownerId, accountStatus: 'active' | 'suspended' }
const ownerStatusSchema = z.object({
  ownerId: z.string().min(1),
  accountStatus: z.enum([ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.SUSPENDED]),
});

export const PATCH = withErrorHandler(
  withAuth(
    withRateLimit(
      async (req: NextRequest, ctx: { auth: AuthContext }) => {
        let body;
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }

        const { ownerId, accountStatus } = ownerStatusSchema.parse(body);
        const newStatus = await adminAccountsService.setAccountStatus({
          targetType: 'owner',
          targetId: ownerId,
          suspend: accountStatus === ACCOUNT_STATUS.SUSPENDED,
          reason: `Admin set account to ${accountStatus} from the PG detail panel`,
          actorUid: ctx.auth.uid,
        });

        return NextResponse.json({ success: true, accountStatus: newStatus });
      },
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['admin'], adminPermission: ADMIN_PERMISSIONS.PLATFORM_VIEW }
  )
);
