import 'server-only';
import { adminAuth, adminDb } from '../firebase-admin';
import { AppError } from '../api/withErrorHandler';
import { recordEvent } from './systemLogs.service';
import { ACCOUNT_STATUS } from '@/lib/constants/status';
import { Timestamp } from 'firebase-admin/firestore';

type TargetType = 'owner' | 'staff' | 'tenant';

/**
 * Admin account suspension/reactivation. Owns the custom-claim writes, token
 * revocation, portal-token invalidation, and audit logging for the
 * `/api/admin/accounts` route so it stays a thin auth + validation layer.
 */
export class AdminAccountsService {
  /**
   * Suspend or reactivate an owner / staff / tenant account. For owners & staff
   * this also flips the `suspended` custom claim and (on suspend) revokes refresh
   * tokens so the block takes effect immediately; suspending a tenant revokes
   * their active portal tokens. Writes an audit_log + admin log event.
   */
  async setAccountStatus(params: {
    targetType: TargetType;
    targetId: string;
    suspend: boolean;
    reason: string;
    actorUid: string;
  }): Promise<string> {
    const { targetType, targetId, suspend, reason, actorUid } = params;
    const newStatus = suspend ? ACCOUNT_STATUS.SUSPENDED : ACCOUNT_STATUS.ACTIVE;
    const now = Timestamp.now();

    if (targetType === 'owner') {
      const ownerRef = adminDb.collection('owners').doc(targetId);
      if (!(await ownerRef.get()).exists) throw new AppError(404, 'Owner not found');
      await adminAuth.setCustomUserClaims(targetId, { suspended: suspend, role: 'owner' });
      if (suspend) await adminAuth.revokeRefreshTokens(targetId);
      await ownerRef.update({ accountStatus: newStatus, updatedAt: now });
    } else if (targetType === 'staff') {
      const staffRef = adminDb.collection('staff').doc(targetId);
      const staffDoc = await staffRef.get();
      if (!staffDoc.exists) throw new AppError(404, 'Staff not found');
      const staffData = staffDoc.data()!;
      await adminAuth.setCustomUserClaims(targetId, {
        role: 'staff',
        ownerId: staffData.ownerId,
        suspended: suspend,
      });
      if (suspend) await adminAuth.revokeRefreshTokens(targetId);
      await staffRef.update({ accountStatus: newStatus, updatedAt: now });
    } else {
      const tenantRef = adminDb.collection('tenants').doc(targetId);
      if (!(await tenantRef.get()).exists) throw new AppError(404, 'Tenant not found');
      await tenantRef.update({ accountStatus: newStatus, updatedAt: now });
      if (suspend) {
        const tokensSnap = await adminDb
          .collection('portal_tokens')
          .where('tenantId', '==', targetId)
          .get();
        const batch = adminDb.batch();
        tokensSnap.docs.forEach((d) => batch.update(d.ref, { revokedAt: now }));
        await batch.commit();
      }
    }

    await adminDb.collection('audit_logs').add({
      actorUid,
      actorRole: 'admin',
      action: `${suspend ? 'suspend' : 'reactivate'}_${targetType}`,
      targetType,
      targetId,
      reason,
      createdAt: now,
    });
    await recordEvent({
      category: 'account',
      level: suspend ? 'warn' : 'info',
      message: `Admin ${suspend ? 'suspend' : 'reactivate'}ed ${targetType} ${targetId} · reason: ${reason}`,
      actorUid,
      targetId,
    });

    return newStatus;
  }
}

export const adminAccountsService = new AdminAccountsService();
