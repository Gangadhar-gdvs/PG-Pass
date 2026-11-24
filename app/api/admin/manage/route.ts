import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { adminDb } from '@/lib/server/firebase-admin';
import { staffService } from '@/lib/server/services/staff.service';
import { ownersService } from '@/lib/server/services/owners.service';
import { recordEvent } from '@/lib/server/services/systemLogs.service';
import { ownerProfileSchema } from '@/lib/validation';
import { ACCOUNT_STATUS } from '@/lib/constants/status';

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
      let body: any;
      try {
        body = await req.json();
      } catch {
        throw new AppError(400, 'Invalid JSON body');
      }
      const action = body.action as string;
      const adminUid = ctx.auth.uid;

      switch (action) {
        case 'updateOwner': {
          const { ownerId, profile } = body;
          if (!ownerId || !profile) throw new AppError(400, 'ownerId and profile are required');

          // Merge onto the existing profile so admin can patch a subset of fields.
          const snap = await adminDb.collection('owners').doc(ownerId).get();
          if (!snap.exists) throw new AppError(404, 'Owner not found');
          const cur = snap.data()!;
          const merged = {
            name: profile.name ?? cur.name,
            phone: profile.phone ?? cur.phone,
            pgName: profile.pgName ?? cur.pgName,
            address: profile.address ?? cur.pgAddress ?? cur.address,
            upiId: profile.upiId ?? cur.upiId,
            upiMerchantName: profile.upiMerchantName ?? cur.upiMerchantName,
            pgCategory: profile.pgCategory ?? cur.pgCategory,
            foodPlan: profile.foodPlan ?? cur.foodPlan,
            foodCuisine: profile.foodCuisine ?? cur.foodCuisine,
            noticePeriodDays: profile.noticePeriodDays ?? cur.noticePeriodDays,
            city: profile.city ?? cur.city,
            area: profile.area ?? cur.area,
            isListed: profile.isListed ?? cur.isListed,
            rentDueDay: profile.rentDueDay ?? cur.rentDueDay,
            lateFeePerDayPaise: profile.lateFeePerDayPaise ?? cur.lateFeePerDayPaise,
            lateFeeGraceDays: profile.lateFeeGraceDays ?? cur.lateFeeGraceDays,
            pgAmenities: profile.pgAmenities ?? cur.pgAmenities,
            totalFloors: profile.totalFloors ?? cur.totalFloors,
          };
          // Validate the MERGED result with the same schema the owner route uses
          // (phone/UPI regex, name min-length, rentDueDay/late-fee ranges, etc.)
          // so the admin act-as-owner path can't write invalid profile data.
          const validated = ownerProfileSchema.parse(merged);
          const updated = await ownersService.upsertProfile(ownerId, validated);
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
          if (!staffUid || ![ACCOUNT_STATUS.ACTIVE, ACCOUNT_STATUS.SUSPENDED].includes(status)) {
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
    { roles: ['admin'] }
  )
);
