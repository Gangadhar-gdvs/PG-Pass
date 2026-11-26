import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { adminAuth, adminDb } from '@/lib/server/firebase-admin';
import { invalidateAdminEntitlements } from '@/lib/server/auth/entitlements';
import { ADMIN_PERMISSIONS } from '@/lib/constants/permissions';
import { Timestamp } from 'firebase-admin/firestore';
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

      // Verify target user exists
      const user = await adminAuth.getUser(targetUid).catch(() => {
        throw new AppError(404, 'Target user does not exist in Firebase Auth');
      });

      // Grant SUPER admin: preserve existing claims + set admin:true, and write
      // an admin_users doc with role 'super' so they appear in the admin roster
      // and get full access via the entitlement system.
      await adminAuth.setCustomUserClaims(targetUid, {
        ...(user.customClaims || {}),
        admin: true,
      });

      const now = Timestamp.now();
      await adminDb.collection('admin_users').doc(targetUid).set(
        {
          id: targetUid,
          email: (user.email || '').toLowerCase(),
          name: user.displayName || undefined,
          role: 'super',
          permissions: [], // super holds everything implicitly
          accountStatus: 'active',
          createdBy: ctx.auth.uid,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );
      invalidateAdminEntitlements(targetUid);

      // Write mandatory audit log
      await adminDb.collection('audit_logs').add({
        actorUid: ctx.auth.uid,
        actorRole: 'admin',
        action: 'grant_super_admin_claim',
        targetType: 'user',
        targetId: targetUid,
        reason,
        createdAt: now,
      });

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
