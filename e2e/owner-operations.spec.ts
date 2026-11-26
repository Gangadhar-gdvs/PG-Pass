import { expect, test, type Locator } from '@playwright/test';
import { OWNER_STATE, TICKET } from './fixtures';

test.use({ storageState: OWNER_STATE });

/** Stat tiles render value + label as separate nodes ("1" / "Published"). */
const expectStat = (scope: Locator, value: string, label: string) =>
  expect(scope).toContainText(new RegExp(`(^|[^\\d₹,])${value}\\s*${label}`));

/** Golden path 4 — owner publishes a notice, works a maintenance ticket, logs an expense. */

test('owner publishes a notice and it appears in the list', async ({ page }) => {
  const title = 'E2E: Water supply off on Sunday';
  await page.goto('/notices');
  await expect(page.getByRole('heading', { name: 'Announcements' })).toBeVisible();
  await page.getByRole('button', { name: 'New notice' }).first().click();
  await page.getByRole('textbox', { name: 'Title' }).fill(title);
  await page.getByRole('textbox', { name: 'Message' }).fill('Tank cleaning from 9am to 1pm. Please store water.');
  await page.getByRole('button', { name: 'Publish notice' }).click();

  const main = page.getByRole('main');
  await expect(main.getByRole('article').filter({ hasText: title })).toBeVisible();
  await expectStat(main, '1', 'Published');
  await page.reload();
  await expect(page.getByRole('main').getByText(title)).toBeVisible();
});

test('owner moves a maintenance ticket Open → In Progress → Resolved', async ({ page }) => {
  await page.goto('/maintenance');
  // The card reads "<Category><status badge>…" followed by a fixed Open/In progress/Resolved
  // track, so the badge is the text right after the category heading.
  const ticket = page.getByRole('article').filter({ hasText: TICKET.description });
  await expect(ticket).toHaveText(/^Plumbing\s*Open/);

  await ticket.getByRole('button', { name: 'Start' }).click();
  await expect(ticket).toHaveText(/^Plumbing\s*In progress/);
  await expect(ticket.getByRole('button', { name: 'Start' })).toBeHidden();

  await ticket.getByRole('button', { name: 'Mark Resolved' }).click();
  await expect(ticket).toHaveText(/^Plumbing\s*Resolved/);
  await expect(ticket.getByRole('button', { name: 'Mark Resolved' })).toBeHidden();

  // Persisted server-side: after a reload the server-filtered "Resolved" view has it.
  await page.reload();
  await page.getByRole('button', { name: 'Resolved', exact: true }).click();
  await expect(page.getByRole('article').filter({ hasText: TICKET.description })).toHaveText(/^Plumbing\s*Resolved/);
});

test('owner records an expense and it appears in the list', async ({ page }) => {
  const vendor = 'E2E Aqua Plumbers';
  await page.goto('/expenses');
  await expect(page.getByRole('heading', { name: 'Record an expense' })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Amount (₹)' }).fill('1500');
  await page.getByRole('textbox', { name: 'Vendor (optional)' }).fill(vendor);
  await page.getByRole('button', { name: 'Add Expense' }).click();

  const main = page.getByRole('main');
  await expect(main.getByText(vendor)).toBeVisible();
  await expect(main.getByRole('listitem').filter({ hasText: vendor })).toContainText('₹1,500');
  await expectStat(main, '1', 'Entries');
  await page.reload();
  await expect(page.getByRole('main').getByText(vendor)).toBeVisible();
});
