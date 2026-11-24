import 'server-only';
import { adminAuth, adminDb } from '../firebase-admin';
import { AppError } from '../api/withErrorHandler';
import { ACCOUNT_STATUS, AccountStatus } from '@/lib/constants/status';
import { Timestamp } from 'firebase-admin/firestore';

export interface StaffMember {
  id: string; // Auth UID
  ownerId: string;
  name: string;
  email: string;
  phone: string;
  role: 'warden';
  accountStatus: AccountStatus;
  invitedBy: string;
  createdAt: any;
  updatedAt?: any;
}

export interface InviteStaffInput {
  name: string;
  email: string;
  phone: string;
}

export class StaffService {
  /**
   * Lists staff members for an owner using Admin SDK (bypasses Firestore client list denial).
   */
  async listStaff(ownerId: string): Promise<StaffMember[]> {
    const snap = await adminDb
      .collection('staff')
      .where('ownerId', '==', ownerId)
      .get();

    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StaffMember));
  }

  /**
   * Invites or creates a staff/warden account scoped strictly to this ownerId.
   */
  async inviteStaff(
    ownerId: string,
    input: InviteStaffInput,
    actorUid: string
  ): Promise<StaffMember & { setupLink?: string }> {
    const ownerDoc = await adminDb.collection('owners').doc(ownerId).get();
    if (!ownerDoc.exists) throw new AppError(404, 'Owner profile not found');

    const maxStaff = ownerDoc.data()?.maxStaff ?? 0;

    // Check plan staff quota
    const currentStaffSnap = await adminDb
      .collection('staff')
      .where('ownerId', '==', ownerId)
      .where('accountStatus', '==', ACCOUNT_STATUS.ACTIVE)
      .count()
      .get();

    if (currentStaffSnap.data().count >= maxStaff) {
      throw new AppError(
        403,
        `Staff account limit reached (${maxStaff} warden(s)). Please upgrade your plan in Billing.`
      );
    }

    const email = input.email.trim().toLowerCase();
    const phone = input.phone.replace(/\D/g, '');

    // 1. Find or create Firebase user
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        userRecord = await adminAuth.createUser({
          email,
          displayName: input.name.trim(),
        });
      } else {
        throw new AppError(500, `Failed to initialize auth user: ${err.message}`);
      }
    }

    const staffUid = userRecord.uid;

    // 2. Set scoped custom claims
    await adminAuth.setCustomUserClaims(staffUid, {
      role: 'staff',
      ownerId,
      suspended: false,
    });

    const now = Timestamp.now();
    const staffRef = adminDb.collection('staff').doc(staffUid);

    const staffDoc: StaffMember = {
      id: staffUid,
      ownerId,
      name: input.name.trim(),
      email,
      phone,
      role: 'warden',
      accountStatus: ACCOUNT_STATUS.ACTIVE,
      invitedBy: actorUid,
      createdAt: now,
      updatedAt: now,
    };

    await staffRef.set(staffDoc);

    // Write audit log
    await adminDb.collection('audit_logs').add({
      actorUid,
      actorRole: 'owner',
      action: 'invite_staff_warden',
      targetType: 'staff',
      targetId: staffUid,
      ownerId,
      createdAt: now,
    });

    // Generate a password-setup link the owner can forward to the warden
    // (zero-cost delivery — no email/SMS provider required). The warden sets a
    // password via this link, then signs in with email + password. Best-effort:
    // if link generation fails, the invite still succeeds.
    let setupLink: string | undefined;
    try {
      setupLink = await adminAuth.generatePasswordResetLink(email);
    } catch {
      setupLink = undefined;
    }

    return { ...staffDoc, setupLink };
  }

  /**
   * Suspends or reactivates a warden.
   */
  async updateStaffStatus(
    staffUid: string,
    ownerId: string,
    status: AccountStatus,
    actorUid: string
  ): Promise<StaffMember> {
    const staffRef = adminDb.collection('staff').doc(staffUid);
    const staffDoc = await staffRef.get();
    if (!staffDoc.exists) throw new AppError(404, 'Staff member not found');

    const data = staffDoc.data() as StaffMember;
    if (data.ownerId !== ownerId) throw new AppError(403, 'Unauthorized');

    const isSuspended = status === ACCOUNT_STATUS.SUSPENDED;

    // Update custom claim & revoke tokens if suspended
    await adminAuth.setCustomUserClaims(staffUid, {
      role: 'staff',
      ownerId,
      suspended: isSuspended,
    });

    if (isSuspended) {
      await adminAuth.revokeRefreshTokens(staffUid);
    }

    const now = Timestamp.now();
    await staffRef.update({
      accountStatus: status,
      updatedAt: now,
    });

    // Write audit log
    await adminDb.collection('audit_logs').add({
      actorUid,
      actorRole: 'owner',
      action: isSuspended ? 'suspend_staff' : 'reactivate_staff',
      targetType: 'staff',
      targetId: staffUid,
      ownerId,
      createdAt: now,
    });

    const updated = await staffRef.get();
    return updated.data() as StaffMember;
  }

  /**
   * Permanently revokes a warden's access.
   */
  async revokeStaff(staffUid: string, ownerId: string, actorUid: string): Promise<void> {
    const staffRef = adminDb.collection('staff').doc(staffUid);
    const staffDoc = await staffRef.get();
    if (!staffDoc.exists) throw new AppError(404, 'Staff member not found');

    const data = staffDoc.data() as StaffMember;
    if (data.ownerId !== ownerId) throw new AppError(403, 'Unauthorized');

    // Wipe custom claims and revoke tokens
    await adminAuth.setCustomUserClaims(staffUid, {});
    await adminAuth.revokeRefreshTokens(staffUid);

    await staffRef.delete();

    // Write audit log
    await adminDb.collection('audit_logs').add({
      actorUid,
      actorRole: 'owner',
      action: 'revoke_staff',
      targetType: 'staff',
      targetId: staffUid,
      ownerId,
      createdAt: Timestamp.now(),
    });
  }
}

export const staffService = new StaffService();
