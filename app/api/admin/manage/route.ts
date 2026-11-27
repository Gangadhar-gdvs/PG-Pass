import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { staffService } from '@/lib/server/services/staff.service';
import { ownersService } from '@/lib/server/services/owners.service';
import { recordEvent } from '@/lib/server/services/systemLogs.service';
import { ACCOUNT_STATUS } from '@/lib/constants/status';
import type { AccountStatus } from '@/types';
import { ADMIN_PERMISSIONS } from '@/lib/constants/permissions';

interface ManageBody {
  action?: string;
  ownerId?: string;
  profile?: Record<string, unknown>;
  staffUid?: string;
  permissions?: string[];
  status?: AccountStatus;
}

/**
 * Admin act-as-owner management. Every action is admin-gated and logged. Lets
 * the platform admin resolve owner issues: edit an owner's settings, set any
 * staff member's permissions, and disable / re-enable / revoke staff.
 *
 * Body: { action, ... }
 *  - 'updateOwner'      { ownerId, profile: {...upsertProfile fields} }
 *  - 'setStaffPerms'    { staffUid, permissions: string[] }
 *  - 'setStaffStatus'   { staffUid, status: 'active'|'suspended' }
 *  - 'revokeStaff'      { staffUid }
 */
export const POST = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext }) => {
      let body: ManageBody;
      try {
        body = (await req.json()) as ManageBody;
      } catch {
        throw new AppError(400, 'Invalid JSON body');
      }
      const action = body.action as string;
      const adminUid = ctx.auth.uid;

      switch (action) {
        case 'updateOwner': {
          const { ownerId, profile } = body;
          if (!ownerId || !profile) throw new AppError(400, 'ownerId and profile are required');

          // Service owns the read-merge-validate-upsert (partial profile merged
          // over the current doc, validated with the same schema as the owner route).
          const updated = await ownersService.adminMergeUpdate(ownerId, profile);
          await recordEvent({
            category: 'account',
            message: 'Admin updated owner profile',
            actorUid: adminUid,
            ownerId,
          }).catch(() => {});
          return NextResponse.json({ success: true, owner: updated });
        }

        case 'setStaffPerms': {
          const { staffUid, permissions } = body;
          if (!staffUid || !Array.isArray(permissions)) {
            throw new AppError(400, 'staffUid and permissions[] are required');
          }
          const updated = await staffService.updatePermissions(
            staffUid,
            '', // ownerId unused for admin
            permissions,
            adminUid,
            'admin'
          );
          return NextResponse.json({ success: true, staff: updated });
        }

        case 'setStaffStatus': {
          const { staffUid, status } = body;
          const validStatuses: AccountStatus[] = [ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.SUSPENDED];
          if (!staffUid || status === undefined || !validStatuses.includes(status)) {
            throw new AppError(400, 'staffUid and a valid status are required');
          }
          const updated = await staffService.updateStaffStatus(staffUid, '', status, adminUid, 'admin');
          return NextResponse.json({ success: true, staff: updated });
        }

        case 'revokeStaff': {
          const { staffUid } = body;
          if (!staffUid) throw new AppError(400, 'staffUid is required');
          await staffService.revokeStaff(staffUid, '', adminUid, 'admin');
          return NextResponse.json({ success: true });
        }

        default:
          throw new AppError(400, `Unknown action: ${action}`);
      }
    },
    { roles: ['admin'], adminPermission: ADMIN_PERMISSIONS.PG_MANAGE }
  )
);
