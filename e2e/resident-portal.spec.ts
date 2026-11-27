import { expect, test, type Page } from '@playwright/test';
import { OWNER, PORTAL_PIN, PORTAL_TOKEN, TENANTS } from './fixtures';

/** Golden path 5 — resident opens their pass link, unlocks with last-4 PIN, sees rent. */

const lockHeading = (page: Page) => page.getByRole('heading', { name: 'Resident Pass Verification' });
const WRONG_PIN = PORTAL_PIN === '1111' ? '2222' : '1111';

async function enterPin(page: Page, pin: string) {
  await page.getByRole('textbox', { name: 'Digit 1' }).click();
  await page.keyboard.type(pin);
  await page.getByRole('button', { name: 'Unlock Resident Pass' }).click();
}

test('wrong PIN is rejected with an error; correct PIN shows rent status', async ({ page }) => {
  await page.goto(`/t/${PORTAL_TOKEN}`);
  await expect(lockHeading(page)).toBeVisible();

  await enterPin(page, WRONG_PIN);
  await expect(page.getByRole('alert').filter({ hasText: /incorrect/i })).toBeVisible();
  await expect(lockHeading(page)).toBeVisible();

  // Fresh lock screen (a failed attempt is not remembered client-side), then the real last-4.
  await page.reload();
  await enterPin(page, PORTAL_PIN);
  await expect(lockHeading(page)).toBeHidden();
  const main = page.getByRole('main');
  await expect(main.getByText(TENANTS['e2e-t-portal'].name.split(' ')[0]).first()).toBeVisible();
  await expect(main.getByText(OWNER.pgName).first()).toBeVisible();
  await expect(main.getByText('₹8,000').first()).toBeVisible();
  await expect(main.getByText(/\b(Due|Pending|Unpaid)\b/i).first()).toBeVisible();
});

test('an unknown pass link never unlocks', async ({ page }) => {
  await page.goto('/t/not-a-real-token-0000000000000000000000000000');
  await enterPin(page, PORTAL_PIN);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(lockHeading(page)).toBeVisible();
});

// Regression for R-A3 (fixed): API errors are `{ error, code, requestId }`; the
// portal used to read `data.message` and always showed the generic "Incorrect
// verification PIN". Clients now read errors through apiErrorMessage/readApiError.
test('portal shows the server error: attempts remaining / link not found', async ({ page }) => {
  // The app's alert — Next.js also renders an empty role="alert" route announcer.
  const appAlert = page.locator('[role="alert"]:not(#__next-route-announcer__)');
  await page.goto(`/t/${PORTAL_TOKEN}`);
  await enterPin(page, WRONG_PIN);
  await expect(appAlert).toContainText(/Incorrect PIN\. \d attempt\(s\) remaining/);

  await page.goto('/t/not-a-real-token-0000000000000000000000000000');
  await enterPin(page, PORTAL_PIN);
  await expect(appAlert).toContainText(/not found|expired/i);
});
