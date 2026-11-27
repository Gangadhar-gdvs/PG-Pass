import { expect, test } from '@playwright/test';
import { STAFF, TENANTS, TICKET, signInViaForm } from './fixtures';

/**
 * Staff run the owner console on the owner's data. Firestore rules now check the
 * live staff doc + per-staff permissions (R-S3/R-S5), so: a warden with the
 * default permissions still gets the live bed grid + residents; a
 * maintenance-only warden never receives resident/rent data in the browser but
 * can still do their job (maintenance is served by the API).
 */

/** Sidebar menu items visible to the signed-in user (desktop layout). */
async function menuLabels(page: import('@playwright/test').Page): Promise<string[]> {
  const menu = page.getByRole('navigation', { name: 'Owner' });
  await expect(menu).toBeVisible();
  return (await menu.getByRole('link').allInnerTexts()).map((t) => t.trim());
}

test('staff with default permissions see the live bed grid, residents and tickets', async ({ page }) => {
  await page.goto('/login');
  await signInViaForm(page, { email: STAFF.staffDefault.email });
  await page.waitForURL('**/dashboard');

  const inventory = page.getByRole('region', { name: 'Bed inventory' });
  await expect(inventory.getByRole('button', { name: /^Bed 101-B, Divya Nair/ })).toBeVisible();
  await expect(page.getByText('Couldn’t load your dashboard')).toHaveCount(0);

  // Menus show exactly what this warden's permissions allow (no expenses /
  // analytics grant; owner-only pages never).
  const menu = await menuLabels(page);
  for (const label of ['Bed Inventory', 'Residents', 'Guests', 'Maintenance', 'Room Inventory', 'Tasks', 'Visitors', 'Notices']) {
    expect(menu).toContain(label);
  }
  for (const label of ['Expenses', 'Analytics', 'Reports', 'Utilities', 'Wardens & Staff', 'Subscription', 'Support', 'Settings']) {
    expect(menu).not.toContain(label);
  }

  await page.goto('/tenants');
  await expect(page.getByRole('row').filter({ hasText: TENANTS['e2e-t-portal'].name })).toBeVisible();

  await page.goto('/maintenance');
  await expect(page.getByRole('article').filter({ hasText: TICKET.description })).toBeVisible();
});

test('maintenance-only staff never get resident data in the browser, but can work tickets', async ({ page }) => {
  await page.goto('/login');
  await signInViaForm(page, { email: STAFF.staffMaintenance.email });
  await page.waitForURL('**/dashboard');

  // Denied resident/rent listeners are expected for this account, not an outage:
  // the dashboard still renders (bed inventory) with an explanatory banner.
  await expect(page.getByText('Resident & rent details are hidden for your account')).toBeVisible();
  await expect(page.getByText('Couldn’t load your dashboard')).toHaveCount(0);

  // Menus + dashboard actions hide what this account can't use.
  const menu = await menuLabels(page);
  expect(menu).toContain('Maintenance');
  for (const label of ['Residents', 'Expenses', 'Guests', 'Analytics', 'Room Inventory', 'Settings', 'Support', 'Utilities']) {
    expect(menu).not.toContain(label);
  }
  await expect(page.getByRole('button', { name: 'Add Resident' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Send Reminders' })).toHaveCount(0);

  await page.goto('/tenants');
  // The tenants listener is denied by the rules → the page shows a clear
  // no-access state instead of a table of residents (no spinner, no phones).
  await expect(page.getByText('No access to residents')).toBeVisible();
  await expect(page.getByText(TENANTS['e2e-t-portal'].phone)).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: TENANTS['e2e-t-rent'].name })).toHaveCount(0);

  await page.goto('/maintenance');
  await expect(page.getByRole('article').filter({ hasText: TICKET.description })).toBeVisible();

  // The API enforces the same permissions as the rules (R-S3b): no expense data
  // for an account without the Expenses permission.
  await page.goto('/expenses');
  await expect(page.getByText('No access to expenses')).toBeVisible();
});
