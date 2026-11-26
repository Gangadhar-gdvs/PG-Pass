import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { adminAuth, adminDb } from '@/lib/server/firebase-admin';
import { recordEvent } from '@/lib/server/services/systemLogs.service';
import { ACCOUNT_STATUS } from '@/lib/constants/status';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { ADMIN_PERMISSIONS } from '@/lib/constants/permissions';

const accountActionSchema = z.object({
  targetType: z.enum(['owner', 'staff', 'tenant']),
  targetId: z.string().min(1),
  action: z.enum(['suspend', 'reactivate']),
  reason: z.string().min(3, 'A clear reason is required'),
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

      const { targetType, targetId, action, reason } = accountActionSchema.parse(body);
      const isSuspend = action === 'suspend';
      const newStatus = isSuspend ? ACCOUNT_STATUS.SUSPENDED : ACCOUNT_STATUS.ACTIVE;
      const now = Timestamp.now();

      if (targetType === 'owner') {
        const ownerRef = adminDb.collection('owners').doc(targetId);
        const ownerDoc = await ownerRef.get();
        if (!ownerDoc.exists) throw new AppError(404, 'Owner not found');

        // 1. Set custom claim & revoke tokens
        await adminAuth.setCustomUserClaims(targetId, {
          suspended: isSuspend,
          role: 'owner',
        });
        if (isSuspend) {
          await adminAuth.revokeRefreshTokens(targetId);
        }

        // 2. Update Firestore doc
        await ownerRef.update({
          accountStatus: newStatus,
          updatedAt: now,
        });

      } else if (targetType === 'staff') {
        const staffRef = adminDb.collection('staff').doc(targetId);
        const staffDoc = await staffRef.get();
        if (!staffDoc.exists) throw new AppError(404, 'Staff not found');

        const staffData = staffDoc.data()!;
        await adminAuth.setCustomUserClaims(targetId, {
          role: 'staff',
          ownerId: staffData.ownerId,
          suspended: isSuspend,
        });
        if (isSuspend) {
          await adminAuth.revokeRefreshTokens(targetId);
        }

        await staffRef.update({
          accountStatus: newStatus,
          updatedAt: now,
        });

      } else if (targetType === 'tenant') {
        const tenantRef = adminDb.collection('tenants').doc(targetId);
        const tenantDoc = await tenantRef.get();
        if (!tenantDoc.exists) throw new AppError(404, 'Tenant not found');

        await tenantRef.update({
          accountStatus: newStatus,
          updatedAt: now,
        });

        // If suspending, revoke all active portal tokens
        if (isSuspend) {
          const tokensSnap = await adminDb
            .collection('portal_tokens')
            .where('tenantId', '==', targetId)
            .get();

          const batch = adminDb.batch();
          tokensSnap.docs.forEach((d) => batch.update(d.ref, { revokedAt: now }));
          await batch.commit();
        }
      }

      // Write mandatory audit log + surface to the admin log stream.
      await adminDb.collection('audit_logs').add({
        actorUid: ctx.auth.uid,
        actorRole: 'admin',
        action: `${action}_${targetType}`,
        targetType,
        targetId,
        reason,
        createdAt: now,
      });
      await recordEvent({
        category: 'account',
        level: action === 'suspend' ? 'warn' : 'info',
        message: `Admin ${action}ed ${targetType} ${targetId} · reason: ${reason}`,
        actorUid: ctx.auth.uid,
        targetId,
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
