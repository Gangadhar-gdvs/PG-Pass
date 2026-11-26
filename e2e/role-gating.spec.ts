import { expect, test } from '@playwright/test';
import { OWNER, OWNER_STATE, PORTAL_PIN, PORTAL_TOKEN, RESIDENT_ACCOUNT, signInViaForm } from './fixtures';

/** Golden path 7 — role gating on pages and APIs. */

test.describe('signed out', () => {
  test('/dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?from=%2Fdashboard$/);
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Bed inventory' })).toHaveCount(0);
  });

  test('owner and admin APIs reject requests without a session (401)', async ({ request }) => {
    for (const path of ['/api/tenants', '/api/maintenance', '/api/admin/overview']) {
      expect((await request.get(path)).status(), path).toBe(401);
    }
  });
});

test.describe('owner session', () => {
  test.use({ storageState: OWNER_STATE });

  test('owner cookie is refused by admin APIs (403) but works on owner APIs', async ({ page }) => {
    const api = page.request;
    expect((await api.get('/api/tenants')).status()).toBe(200);
    for (const path of ['/api/admin/overview', `/api/admin/pg-detail?ownerId=${OWNER.uid}`, '/api/admin/me']) {
      const res = await api.get(path);
      expect(res.status(), path).toBe(403);
    }
  });

  test('owner visiting /admin gets no admin console', async ({ page }) => {
    await page.goto('/admin');
    // The owner's Firebase session is recognised but lacks the admin claim.
    await expect(page.getByText('Not an admin account')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In to Admin Console' })).toBeVisible();
    await expect(page.getByText('Total PGs')).toHaveCount(0);
  });
});

test.describe('resident', () => {
  test('resident account is sent to the resident app and refused by /dashboard + owner APIs', async ({ page }) => {
    await page.goto('/login');
    await signInViaForm(page, { email: RESIDENT_ACCOUNT.email });
    await page.waitForURL('**/resident/home');

    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/\/dashboard/);
    await expect(page.getByRole('region', { name: 'Bed inventory' })).toHaveCount(0);

    for (const path of ['/api/tenants', '/api/maintenance', '/api/admin/overview']) {
      expect((await page.request.get(path)).status(), path).toBe(403);
    }
  });

  test('an unlocked resident pass grants no owner access', async ({ page }) => {
    await page.goto(`/t/${PORTAL_TOKEN}`);
    await page.getByRole('textbox', { name: 'Digit 1' }).click();
    await page.keyboard.type(PORTAL_PIN);
    await page.getByRole('button', { name: 'Unlock Resident Pass' }).click();
    await expect(page.getByRole('heading', { name: 'Resident Pass Verification' })).toBeHidden();

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    expect((await page.request.get('/api/tenants')).status()).toBe(401);
  });
});
