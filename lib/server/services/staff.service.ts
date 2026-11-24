import 'server-only';
import { adminAuth, adminDb } from '../firebase-admin';
import { AppError } from '../api/withErrorHandler';
import { ACCOUNT_STATUS, AccountStatus } from '@/lib/constants/status';
import {
  DEFAULT_STAFF_PERMISSIONS,
  ALL_STAFF_PERMISSIONS,
  StaffPermission,
} from '@/lib/constants/permissions';
import { invalidateStaffPermissions } from '../auth/entitlements';
import { Timestamp } from 'firebase-admin/firestore';

export interface StaffMember {
  id: string; // Auth UID
  uid?: string; // mirror of id for client handlers that key off uid
  ownerId: string;
  name: string;
  email: string;
  phone: string;
  role: 'warden';
  accountStatus: AccountStatus;
  permissions?: StaffPermission[];
  invitedBy: string;
  createdAt: any;
  updatedAt?: any;
  deletedAt?: any | null; // soft-delete marker; null/absent = active
  revokedBy?: string;
}

export interface InviteStaffInput {
  name: string;
  email: string;
  phone: string;
}

export class StaffService {
  /**
   * Lists ACTIVE staff members for an owner (Admin SDK bypasses client list
   * denial). Soft-deleted (revoked) staff are excluded from the working list.
   * `includeRevoked` returns them too (for admin history views).
   */
  async listStaff(ownerId: string, includeRevoked = false): Promise<StaffMember[]> {
    const snap = await adminDb
      .collection('staff')
      .where('ownerId', '==', ownerId)
      .limit(100)
      .get();

    return snap.docs
      // Emit both `id` and `uid` (same value) — the owner staff page keys
      // suspend/revoke actions off `uid`, which the stored doc doesn't carry.
      .map((d) => ({ id: d.id, uid: d.id, ...d.data() } as StaffMember))
      .filter((s) => includeRevoked || !s.deletedAt);
  }

  /**
   * Invites or creates a staff/warden account scoped strictly to this ownerId.
   */
  async inviteStaff(
    ownerId: string,
    input: InviteStaffInput,
    actorUid: string
  ): Promise<StaffMember & { setupLink?: string }> {
    const [ownerDoc, currentStaffSnap] = await Promise.all([
      adminDb.collection('owners').doc(ownerId).get(),
      adminDb
        .collection('staff')
        .where('ownerId', '==', ownerId)
        .where('accountStatus', '==', ACCOUNT_STATUS.ACTIVE)
        .count()
        .get(),
    ]);
    if (!ownerDoc.exists) throw new AppError(404, 'Owner profile not found');

    const maxStaff = ownerDoc.data()?.maxStaff ?? 0;

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
      permissions: DEFAULT_STAFF_PERMISSIONS,
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
    actorUid: string,
    actorRole: 'owner' | 'admin' = 'owner'
  ): Promise<StaffMember> {
    const staffRef = adminDb.collection('staff').doc(staffUid);
    const staffDoc = await staffRef.get();
    if (!staffDoc.exists) throw new AppError(404, 'Staff member not found');

    const data = staffDoc.data() as StaffMember;
    // Owners may only act on their own staff; admins may act on any.
    if (actorRole !== 'admin' && data.ownerId !== ownerId) throw new AppError(403, 'Unauthorized');

    const isSuspended = status === ACCOUNT_STATUS.SUSPENDED;

    // Update custom claim & revoke tokens if suspended. Use the staff member's
    // OWN ownerId (not the caller's) so an admin action keeps the claim correct.
    await adminAuth.setCustomUserClaims(staffUid, {
      role: 'staff',
      ownerId: data.ownerId,
      suspended: isSuspended,
    });

    if (isSuspended) {
      await adminAuth.revokeRefreshTokens(staffUid);
    }

    const now = Timestamp.now();
    const patch = { accountStatus: status, updatedAt: now };
    await staffRef.update(patch);

    // Write audit log
    await adminDb.collection('audit_logs').add({
      actorUid,
      actorRole,
      action: isSuspended ? 'suspend_staff' : 'reactivate_staff',
      targetType: 'staff',
      targetId: staffUid,
      ownerId: data.ownerId,
      createdAt: now,
    });

    // Return the locally-merged result — no extra read round-trip.
    return { ...data, ...patch };
  }

  /**
   * Owner sets a staff member's granted permissions. Each staff member is
   * independent (no merging between staff). Validated against the known set and
   * enforced server-side via withAuth; the cached copy is invalidated.
   */
  async updatePermissions(
    staffUid: string,
    ownerId: string,
    permissions: string[],
    actorUid: string,
    actorRole: 'owner' | 'admin' = 'owner'
  ): Promise<StaffMember> {
    const staffRef = adminDb.collection('staff').doc(staffUid);
    const staffDoc = await staffRef.get();
    if (!staffDoc.exists) throw new AppError(404, 'Staff member not found');

    const data = staffDoc.data() as StaffMember;
    if (actorRole !== 'admin' && data.ownerId !== ownerId) throw new AppError(403, 'Unauthorized');

    const clean = (Array.isArray(permissions) ? permissions : []).filter(
      (p): p is StaffPermission => (ALL_STAFF_PERMISSIONS as string[]).includes(p)
    );
    const unique = Array.from(new Set(clean));

    const now = Timestamp.now();
    await staffRef.update({ permissions: unique, updatedAt: now });
    invalidateStaffPermissions(staffUid);

    await adminDb.collection('audit_logs').add({
      actorUid,
      actorRole,
      action: 'update_staff_permissions',
      targetType: 'staff',
      targetId: staffUid,
      ownerId: data.ownerId,
      details: { permissions: unique },
      createdAt: now,
    });

    return { ...data, permissions: unique, updatedAt: now };
  }

  /**
   * Revokes a warden's access. SOFT delete: the staff record is kept (for
   * history / audit), marked `deletedAt` + accountStatus 'revoked', with auth
   * claims wiped and refresh tokens revoked so they can no longer sign in.
   * `actorRole` distinguishes owner vs admin action in the audit trail.
   */
  async revokeStaff(
    staffUid: string,
    ownerId: string,
    actorUid: string,
    actorRole: 'owner' | 'admin' = 'owner'
  ): Promise<void> {
    const staffRef = adminDb.collection('staff').doc(staffUid);
    const staffDoc = await staffRef.get();
    if (!staffDoc.exists) throw new AppError(404, 'Staff member not found');

    const data = staffDoc.data() as StaffMember;
    // Owners may only revoke their own staff; admins may revoke any.
    if (actorRole !== 'admin' && data.ownerId !== ownerId) {
      throw new AppError(403, 'Unauthorized');
    }

    // Wipe custom claims and revoke tokens so the account can no longer sign in.
    await adminAuth.setCustomUserClaims(staffUid, { suspended: true });
    await adminAuth.revokeRefreshTokens(staffUid);
    invalidateStaffPermissions(staffUid);

    const now = Timestamp.now();
    // SOFT delete — keep the record, mark revoked. `permissions` cleared so no
    // stale grant survives a hypothetical re-activation.
    await staffRef.update({
      accountStatus: ACCOUNT_STATUS.REVOKED,
      deletedAt: now,
      revokedBy: actorUid,
      permissions: [],
      updatedAt: now,
    });

    await adminDb.collection('audit_logs').add({
      actorUid,
      actorRole,
      action: 'revoke_staff',
      targetType: 'staff',
      targetId: staffUid,
      ownerId: data.ownerId,
      createdAt: now,
    });
  }
}

export const staffService = new StaffService();
