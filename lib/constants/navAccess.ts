import { STAFF_PERMISSIONS, type StaffPermission } from './permissions';

/**
 * Which owner-console pages a STAFF member may see in menus. Owners see all.
 *   'owner' → owner-only page
 *   []      → any active staff member
 *   [a, b]  → staff holding at least one of these permissions
 * Mirrors the GET-route gates (`withAuth`) and `isStaffWith()` in
 * firestore.rules, so a menu item is shown only when its page can load data.
 * Pages missing from this map are hidden from staff (deny by default).
 */
export const STAFF_PAGE_ACCESS: Record<string, 'owner' | StaffPermission[]> = {
  '/dashboard': [],
  '/profile': [],
  '/tasks': [],
  '/visitors': [],
  '/notices': [],
  '/tenants': [STAFF_PERMISSIONS.MANAGE_TENANTS, STAFF_PERMISSIONS.COLLECT_RENT],
  '/guests': [STAFF_PERMISSIONS.MANAGE_GUESTS],
  '/analytics': [STAFF_PERMISSIONS.VIEW_ANALYTICS],
  '/maintenance': [STAFF_PERMISSIONS.MANAGE_MAINTENANCE],
  '/expenses': [STAFF_PERMISSIONS.MANAGE_EXPENSES],
  '/inventory': [STAFF_PERMISSIONS.MANAGE_BEDS],
  '/reports': 'owner',
  '/staff': 'owner',
  '/billing': 'owner',
  '/settings': 'owner',
  '/support': 'owner',
  '/utilities': 'owner',
};

export function canAccessPage(
  href: string,
  role: string,
  permissions: readonly string[] = []
): boolean {
  if (role !== 'staff') return true;
  const rule = STAFF_PAGE_ACCESS[href];
  if (rule === undefined || rule === 'owner') return false;
  return rule.length === 0 || rule.some((p) => permissions.includes(p));
}

/** True when staff hold at least one of `perms` (owners always true). */
export function hasAnyPermission(role: string, permissions: readonly string[] = [], perms: readonly StaffPermission[]): boolean {
  return role !== 'staff' || perms.some((p) => permissions.includes(p));
}
