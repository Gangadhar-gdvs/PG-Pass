import 'server-only';
import { adminAuth, adminDb } from '../firebase-admin';
import { AppError } from '../api/withErrorHandler';
import {
  ADMIN_ROLE,
  AdminRole,
  AdminPermission,
  GRANTABLE_ADMIN_PERMISSIONS,
  DEFAULT_ADMIN_PERMISSIONS,
} from '@/lib/constants/permissions';
import { invalidateAdminEntitlements } from '../auth/entitlements';
import { recordEvent } from './systemLogs.service';
import { Timestamp } from 'firebase-admin/firestore';
import { Timestampish } from '@/types';
import { errorMessage } from '@/lib/utils';

export interface AdminUser {
  id: string; // Auth UID
  email: string;
  name?: string;
  role: AdminRole;
  permissions: AdminPermission[]; // empty for super (implicitly all)
  accountStatus: 'active' | 'suspended';
  createdBy: string; // super-admin uid who created this admin
  createdAt: Timestampish;
  updatedAt?: Timestampish;
}

/** Only keep known, GRANTABLE permission keys (never `admins.manage`). */
function sanitizePermissions(raw: unknown): AdminPermission[] {
  const list = Array.isArray(raw) ? raw : [];
  return (GRANTABLE_ADMIN_PERMISSIONS as string[]).filter((p) =>
    list.includes(p)
  ) as AdminPermission[];
}

export class AdminUsersService {
  /** All platform admins (super + staff). Super-admin-only. */
  async listAdmins(): Promise<AdminUser[]> {
    const snap = await adminDb.collection('admin_users').orderBy('createdAt', 'desc').limit(100).get();
    return snap.docs.map((d) => ({ ...(d.data() as AdminUser), id: d.id }));
  }

  /**
   * Create (or promote) a platform admin by email. Sets the `admin:true` custom
   * claim + an `admin_users` doc with role 'staff' and the given permissions.
   * Only a super admin may call this (enforced at the route via adminPermission).
   */
  async createAdmin(
    createdBy: string,
    input: { email: string; name?: string; permissions?: AdminPermission[] }
  ): Promise<AdminUser> {
    const email = input.email.trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      throw new AppError(400, 'A valid email is required');
    }

    // The target must already be a Firebase Auth user (they sign in with their
    // existing email/password or Google). We never create passwords here.
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(email);
    } catch {
      throw new AppError(
        404,
        'No account exists for that email. Ask them to sign in once (creating their account), then add them as an admin.'
      );
    }
    const uid = userRecord.uid;

    const existing = await adminDb.collection('admin_users').doc(uid).get();
    if (existing.exists) {
      throw new AppError(409, 'This user is already an admin.');
    }

    const permissions = sanitizePermissions(input.permissions ?? DEFAULT_ADMIN_PERMISSIONS);
    const now = Timestamp.now();
    const doc: AdminUser = {
      id: uid,
      email,
      name: input.name?.trim() || userRecord.displayName || undefined,
      role: ADMIN_ROLE.STAFF, // new admins are always staff; super is bootstrap-only
      permissions,
      accountStatus: 'active',
      createdBy,
      createdAt: now,
      updatedAt: now,
    };

    try {
      // Preserve any existing claims (e.g. an owner who is also made an admin).
      const existingClaims = userRecord.customClaims || {};
      await adminAuth.setCustomUserClaims(uid, { ...existingClaims, admin: true });
    } catch (e) {
      throw new AppError(500, `Could not set admin claim: ${errorMessage(e, 'unknown error')}`);
    }

    await adminDb.collection('admin_users').doc(uid).set(doc);
    invalidateAdminEntitlements(uid);

    await recordEvent({
      category: 'account',
      level: 'warn',
      message: `Admin created: ${email} (staff) by ${createdBy}`,
      targetId: uid,
    });
    return doc;
  }

  /** Update a staff admin's granted permissions. Super-admin-only. */
  async setPermissions(
    actorUid: string,
    targetUid: string,
    permissions: AdminPermission[]
  ): Promise<AdminUser> {
    const ref = adminDb.collection('admin_users').doc(targetUid);
    const snap = await ref.get();
    if (!snap.exists) throw new AppError(404, 'Admin not found');
    const data = snap.data() as AdminUser;
    if (data.role === ADMIN_ROLE.SUPER) {
      throw new AppError(400, "A super admin's permissions can't be edited — they have full access by design.");
    }

    const clean = sanitizePermissions(permissions);
    const now = Timestamp.now();
    await ref.update({ permissions: clean, updatedAt: now });
    invalidateAdminEntitlements(targetUid);

    await recordEvent({
      category: 'account',
      level: 'info',
      message: `Admin permissions updated for ${data.email} by ${actorUid}`,
      targetId: targetUid,
    });
    return { ...data, id: targetUid, permissions: clean, updatedAt: now };
  }

  /** Suspend or reactivate a staff admin. Super-admin-only. Cannot target a super admin. */
  async setStatus(
    actorUid: string,
    targetUid: string,
    status: 'active' | 'suspended'
  ): Promise<AdminUser> {
    if (actorUid === targetUid) {
      throw new AppError(400, 'You cannot change your own admin status.');
    }
    const ref = adminDb.collection('admin_users').doc(targetUid);
    const snap = await ref.get();
    if (!snap.exists) throw new AppError(404, 'Admin not found');
    const data = snap.data() as AdminUser;
    if (data.role === ADMIN_ROLE.SUPER) {
      throw new AppError(400, 'A super admin cannot be suspended.');
    }

    const now = Timestamp.now();
    await ref.update({ accountStatus: status, updatedAt: now });

    // When suspended, also drop the admin claim and revoke tokens so access ends
    // immediately (not just when the 60s entitlement cache expires).
    if (status === 'suspended') {
      try {
        const user = await adminAuth.getUser(targetUid);
        const claims = { ...(user.customClaims || {}) };
        delete claims.admin;
        await adminAuth.setCustomUserClaims(targetUid, claims);
        await adminAuth.revokeRefreshTokens(targetUid);
      } catch {
        /* best-effort — the doc status + entitlement check still block access */
      }
    } else {
      try {
        const user = await adminAuth.getUser(targetUid);
        await adminAuth.setCustomUserClaims(targetUid, { ...(user.customClaims || {}), admin: true });
      } catch {
        /* best-effort */
      }
    }

    invalidateAdminEntitlements(targetUid);
    await recordEvent({
      category: 'account',
      level: 'warn',
      message: `Admin ${status === 'suspended' ? 'suspended' : 'reactivated'}: ${data.email} by ${actorUid}`,
      targetId: targetUid,
    });
    return { ...data, id: targetUid, accountStatus: status, updatedAt: now };
  }

  /**
   * Grant SUPER admin to an existing Firebase user by UID: preserves their other
   * claims + sets `admin:true`, writes/merges an `admin_users` doc with role
   * 'super' (full access via the entitlement system), and audit-logs it.
   * Super-only (enforced at the route via `ADMINS_MANAGE`).
   */
  async grantSuperAdmin(actorUid: string, targetUid: string, reason: string): Promise<void> {
    const user = await adminAuth.getUser(targetUid).catch(() => {
      throw new AppError(404, 'Target user does not exist in Firebase Auth');
    });

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
        role: ADMIN_ROLE.SUPER,
        permissions: [], // super holds everything implicitly
        accountStatus: 'active',
        createdBy: actorUid,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
    invalidateAdminEntitlements(targetUid);

    await adminDb.collection('audit_logs').add({
      actorUid,
      actorRole: 'admin',
      action: 'grant_super_admin_claim',
      targetType: 'user',
      targetId: targetUid,
      reason,
      createdAt: now,
    });
  }
}

export const adminUsersService = new AdminUsersService();
