import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { STAFF_PAGE_ACCESS, canAccessPage, hasAnyPermission } from '@/lib/constants/navAccess';
import { ALL_STAFF_PERMISSIONS } from '@/lib/constants/permissions';

describe('owner-console menu access', () => {
  it('owners see every page', () => {
    for (const href of Object.keys(STAFF_PAGE_ACCESS)) expect(canAccessPage(href, 'owner')).toBe(true);
  });

  it('staff never see owner-only pages, even with every permission', () => {
    for (const href of ['/reports', '/staff', '/billing', '/settings', '/support', '/utilities']) {
      expect(canAccessPage(href, 'staff', ALL_STAFF_PERMISSIONS)).toBe(false);
    }
  });

  it('staff with no permissions see only the everyday pages', () => {
    const visible = Object.keys(STAFF_PAGE_ACCESS).filter((h) => canAccessPage(h, 'staff', []));
    expect(visible.sort()).toEqual(['/dashboard', '/notices', '/profile', '/tasks', '/visitors']);
  });

  it('a permission unlocks exactly its pages', () => {
    expect(canAccessPage('/tenants', 'staff', ['collect_rent'])).toBe(true);
    expect(canAccessPage('/tenants', 'staff', ['manage_tenants'])).toBe(true);
    expect(canAccessPage('/tenants', 'staff', ['manage_maintenance'])).toBe(false);
    expect(canAccessPage('/maintenance', 'staff', ['manage_maintenance'])).toBe(true);
    expect(canAccessPage('/expenses', 'staff', ['manage_maintenance'])).toBe(false);
    expect(canAccessPage('/inventory', 'staff', ['manage_beds'])).toBe(true);
    expect(canAccessPage('/guests', 'staff', ['manage_guests'])).toBe(true);
    expect(canAccessPage('/analytics', 'staff', ['view_analytics'])).toBe(true);
  });

  it('unknown pages are hidden from staff by default', () => {
    expect(canAccessPage('/some-new-page', 'staff', ALL_STAFF_PERMISSIONS)).toBe(false);
    expect(canAccessPage('/some-new-page', 'owner')).toBe(true);
  });

  it('hasAnyPermission: owners always, staff only with a matching grant', () => {
    expect(hasAnyPermission('owner', [], ['collect_rent'])).toBe(true);
    expect(hasAnyPermission('staff', ['collect_rent'], ['collect_rent'])).toBe(true);
    expect(hasAnyPermission('staff', ['manage_beds'], ['collect_rent'])).toBe(false);
  });

  it('every owner-console page has an access rule (add one when you add a page)', () => {
    const dir = path.resolve(__dirname, '../../app/(owner)');
    const pages = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, 'page.tsx')))
      .map((d) => `/${d.name}`);
    expect(pages.length).toBeGreaterThan(10);
    for (const href of pages) expect(Object.keys(STAFF_PAGE_ACCESS)).toContain(href);
  });
});
