import { expect, test } from '@playwright/test';
import { OWNER_STATE } from './fixtures';

test.use({ storageState: OWNER_STATE });

/** Golden path 3 — owner marks a pending rent record paid from the bed drawer. */
test('owner marks a pending rent record as Paid', async ({ page }) => {
  await page.goto('/dashboard');
  const main = page.getByRole('main');
  await expect(main).toContainText(/Total Collection\s*₹0\s*0 paid/);
  await expect(main).toContainText(/Pending Dues\s*₹16,000\s*2 due/);

  const inventory = page.getByRole('region', { name: 'Bed inventory' });
  const tile = inventory.getByRole('button', { name: /^Bed 101-A, Kiran Rao/ });
  await expect(tile).toContainText('Due');
  await tile.click();

  const drawer = page.getByRole('dialog', { name: 'Bed 101-A' });
  await expect(drawer.getByRole('heading', { name: 'Kiran Rao' })).toBeVisible();
  await expect(drawer.getByText('₹0 / ₹8,000')).toBeVisible();
  await drawer.getByRole('button', { name: 'Mark as Paid' }).click();

  await expect(page.getByRole('status').filter({ hasText: /Bed 101-A marked Paid! Receipt REC-\d{5} issued/ })).toBeVisible();
  await expect(drawer.getByText('Paid', { exact: true }).first()).toBeVisible();
  // A settled record swaps the actions: no more "Mark as Paid", reversal offered instead.
  await expect(drawer.getByRole('button', { name: 'Mark as Paid' })).toBeHidden();
  await expect(drawer.getByRole('button', { name: 'Reverse Payment' })).toBeVisible();

  // Close the drawer: the grid + summary reflect the settled record live.
  await drawer.getByRole('button', { name: 'Close' }).click();
  await expect(tile).toContainText('Paid');
  await expect(main).toContainText(/Total Collection\s*₹8,000\s*1 paid/);
  await expect(main).toContainText(/Pending Dues\s*₹8,000\s*1 due/);

  // Persisted server-side: survives a full reload.
  await page.reload();
  await expect(inventory.getByRole('button', { name: /^Bed 101-A, Kiran Rao/ })).toContainText('Paid');
});
