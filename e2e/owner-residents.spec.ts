import { expect, test } from '@playwright/test';
import { OWNER_STATE } from './fixtures';

test.use({ storageState: OWNER_STATE });

/** Golden path 2 — Add Resident to a vacant bed → resident shows on /tenants. */
test('owner assigns a resident to a vacant bed and sees them in the directory', async ({ page }) => {
  const resident = { name: 'Anil Kumar', phone: '9000044444' };

  await page.goto('/dashboard');
  const inventory = page.getByRole('region', { name: 'Bed inventory' });
  await inventory
    .getByRole('button', { name: /^Bed 102-A, vacant/ })
    .getByRole('button', { name: 'Assign' })
    .click();

  const drawer = page.getByRole('dialog', { name: 'Assign Bed 102-A' });
  await expect(drawer).toBeVisible();
  await drawer.getByRole('textbox', { name: 'Resident Full Name' }).fill(resident.name);
  await drawer.getByRole('textbox', { name: 'WhatsApp Number' }).fill(resident.phone);
  // Rent/deposit are prefilled from the bed (₹9,000); keep them.
  await expect(drawer.getByRole('spinbutton', { name: 'Monthly Rent (₹)' })).toHaveValue('9000');
  await drawer.getByRole('button', { name: 'Assign Resident & Generate Link' }).click();

  await expect(page.getByRole('status').filter({ hasText: `${resident.name} assigned to Bed 102-A` })).toBeVisible();
  // The live bed grid flips the tile to occupied (Firestore onSnapshot).
  await page.keyboard.press('Escape');
  await expect(inventory.getByRole('button', { name: new RegExp(`^Bed 102-A, ${resident.name}`) })).toBeVisible();
  await expect(page.getByRole('link', { name: '3 Residents' })).toBeVisible();

  await page.goto('/tenants');
  await expect(page.getByRole('heading', { name: 'Resident Directory' })).toBeVisible();
  const row = page.getByRole('row').filter({ hasText: resident.name });
  await expect(row).toBeVisible();
  await expect(row.getByRole('cell', { name: '102-A' })).toBeVisible();
  await expect(row.getByRole('cell', { name: `+91 ${resident.phone}` })).toBeVisible();
  // A real resident-pass link was issued.
  await expect(row.getByRole('link', { name: 'Open portal' })).toHaveAttribute('href', /^\/t\/[A-Za-z0-9_-]{43}$/);
});
