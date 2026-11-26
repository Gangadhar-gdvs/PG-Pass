import { expect, test as setup } from '@playwright/test';
import { BEDS, OWNER, OWNER_STATE, signInViaForm } from './fixtures';

/**
 * Golden path 1 — owner signs in through /login (email/password) → lands on
 * /dashboard → sees their PG and bed inventory. Runs once as the `setup`
 * project and saves the session (cookies + Firebase IndexedDB auth) so the
 * other owner specs reuse it: owners are single-active-session, so logging in
 * again per test would supersede the previous session.
 */
setup('owner signs in via /login and sees their PG + bed inventory', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  await signInViaForm(page, { email: OWNER.email });

  await page.waitForURL('**/dashboard');
  await expect(page.getByRole('heading', { level: 1, name: new RegExp(OWNER.name) })).toBeVisible();
  const main = page.getByRole('main');
  await expect(main.getByText(OWNER.pgName).first()).toBeVisible();

  // Bed inventory: totals tiles + one tile per seeded bed.
  await expect(main.getByRole('link', { name: `${BEDS.length} Total Beds` })).toBeVisible();
  await expect(main.getByRole('link', { name: '2 Total Rooms' })).toBeVisible();
  const inventory = page.getByRole('region', { name: 'Bed inventory' });
  for (const b of BEDS) {
    await expect(inventory.getByRole('button', { name: new RegExp(`^Bed ${b.label},`) })).toBeVisible();
  }
  await expect(inventory.getByRole('button', { name: /Bed 101-A, Kiran Rao/ })).toBeVisible();
  await expect(inventory.getByRole('button', { name: /Bed 102-A, vacant/ })).toBeVisible();

  await page.context().storageState({ path: OWNER_STATE, indexedDB: true });
});
