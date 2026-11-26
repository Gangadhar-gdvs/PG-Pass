import { describe, it, expect } from 'vitest';
import {
  ADMIN_PERMISSIONS,
  ALL_ADMIN_PERMISSIONS,
  GRANTABLE_ADMIN_PERMISSIONS,
  DEFAULT_ADMIN_PERMISSIONS,
} from '@/lib/constants/permissions';

/**
 * Guards the admin authorization vocabulary + the super/staff access rule.
 * These mirror the server enforcement in `entitlements.adminHasPermission` and
 * `withAuth({ adminPermission })`.
 */

// Mirrors entitlements.adminHasPermission (super bypasses; suspended blocked).
function adminCan(
  role: 'super' | 'staff',
  perms: string[],
  accountStatus: 'active' | 'suspended',
  needed: string
): boolean {
  if (accountStatus !== 'active') return false;
  if (role === 'super') return true;
  return perms.includes(needed);
}

describe('Admin permissions vocabulary', () => {
  it('admins.manage is NOT grantable to a staff admin (super-only)', () => {
    expect(GRANTABLE_ADMIN_PERMISSIONS).not.toContain(ADMIN_PERMISSIONS.ADMINS_MANAGE);
    // every other permission IS grantable
    const nonManage = ALL_ADMIN_PERMISSIONS.filter((p) => p !== ADMIN_PERMISSIONS.ADMINS_MANAGE);
    for (const p of nonManage) expect(GRANTABLE_ADMIN_PERMISSIONS).toContain(p);
  });

  it('defaults are read-only-ish (no pg.manage / subscriptions / admins)', () => {
    expect(DEFAULT_ADMIN_PERMISSIONS).toContain(ADMIN_PERMISSIONS.PLATFORM_VIEW);
    expect(DEFAULT_ADMIN_PERMISSIONS).not.toContain(ADMIN_PERMISSIONS.PG_MANAGE);
    expect(DEFAULT_ADMIN_PERMISSIONS).not.toContain(ADMIN_PERMISSIONS.ADMINS_MANAGE);
  });
});

describe('adminCan — super/staff access rule', () => {
  it('super admin passes every permission', () => {
    for (const p of ALL_ADMIN_PERMISSIONS) {
      expect(adminCan('super', [], 'active', p)).toBe(true);
    }
  });

  it('staff admin only passes granted permissions', () => {
    const perms = [ADMIN_PERMISSIONS.PLATFORM_VIEW, ADMIN_PERMISSIONS.SUPPORT_MANAGE];
    expect(adminCan('staff', perms, 'active', ADMIN_PERMISSIONS.PLATFORM_VIEW)).toBe(true);
    expect(adminCan('staff', perms, 'active', ADMIN_PERMISSIONS.SUBSCRIPTIONS_MANAGE)).toBe(false);
    // a staff admin can NEVER hold admins.manage
    expect(adminCan('staff', perms, 'active', ADMIN_PERMISSIONS.ADMINS_MANAGE)).toBe(false);
  });

  it('a suspended admin passes nothing, even a super', () => {
    expect(adminCan('super', [], 'suspended', ADMIN_PERMISSIONS.PLATFORM_VIEW)).toBe(false);
    expect(adminCan('staff', [ADMIN_PERMISSIONS.PLATFORM_VIEW], 'suspended', ADMIN_PERMISSIONS.PLATFORM_VIEW)).toBe(false);
  });
});
