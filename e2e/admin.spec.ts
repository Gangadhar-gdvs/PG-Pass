import { expect, test, type Page } from '@playwright/test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { ADMIN, OWNER, PASSWORD, PROJECT_ID } from './fixtures';

/** Golden path 6 — admin signs in through /admin → platform stats + the PG directory. */

async function adminSignIn(page: Page) {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'PGPass Super Admin' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Admin Email Address' }).fill(ADMIN.email);
  await page.getByRole('textbox', { name: 'Admin Password' }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In to Admin Console' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Welcome back/ })).toBeVisible();
}

/** Stat tiles render "<value>\n<label>"; read the number right before the label. */
async function statValue(page: Page, label: string): Promise<number> {
  const text = await page.getByRole('main').innerText();
  const m = text.match(new RegExp(`([\\d,]+)\\s*${label}`));
  return m ? Number(m[1].replace(/,/g, '')) : NaN;
}

async function expectConsoleLoaded(page: Page) {
  await expect.poll(() => statValue(page, 'Total PGs')).toBeGreaterThanOrEqual(1);
  await expect.poll(() => statValue(page, 'Total Beds')).toBeGreaterThanOrEqual(4);
  await expect.poll(() => statValue(page, 'Active Residents')).toBeGreaterThanOrEqual(2);

  // The directory lists owners by doc id (50/page); the e2e PG is on page 1 in dev data.
  // (Not using the search box here — see the search fixme below.)
  const directory = page.getByRole('region', { name: 'PG directory' });
  await expect(directory.getByText(OWNER.pgName).first()).toBeVisible();
}

test('admin signs in via /admin and sees platform stats and the seeded PG in the directory', async ({ page }) => {
  await adminSignIn(page);
  // See the fixme below: the first load right after sign-in races the session
  // cookie, so a returning admin (reload) is what reliably shows telemetry today.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: /Welcome back/ })).toBeVisible();
  await expectConsoleLoaded(page);
});

// BUG (reported, app code not changed): app/admin/page.tsx — signInWithEmailAndPassword
// fires onAuthStateChanged, which calls loadMe() + loadPlatformData() in parallel with
// handleAuthSubmit's POST /api/auth/session. Both GETs go out before the session cookie
// exists → 401 → "Couldn't load platform telemetry" + empty directory until the admin
// presses Retry or reloads. Remove `fixme` once the console loads data after the session
// is established.
test.fixme('admin console shows telemetry immediately after form sign-in (no reload)', async ({ page }) => {
  await adminSignIn(page);
  await expect(page.getByText("Couldn't load platform telemetry")).toHaveCount(0);
  await expectConsoleLoaded(page);
});

// BUG (reported, app code not changed): app/admin/page.tsx filteredPgs calls
// pg.owner.pgName/name.toLowerCase() and owner.phone.includes() unguarded. An owner doc
// without those fields — exactly what setActiveSession() writes for a fresh sign-up that
// hasn't finished onboarding (`owners/{uid}` = { currentSessionId, … } only) — makes the
// whole admin console crash ("Something went wrong") as soon as the admin types in
// "Search PG or owner". Remove `fixme` once the filter tolerates missing fields.
test.fixme('admin directory search survives an owner without a PG profile', async ({ page }) => {
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
  const app = initializeApp({ projectId: PROJECT_ID }, `e2e-bare-owner-${Date.now()}`);
  const bare = getFirestore(app).doc('owners/e2e-zz-bare-owner');
  await bare.set({ currentSessionId: 'e2e-bare' }); // what a fresh sign-up leaves behind
  try {
    await adminSignIn(page);
    await page.reload();
    const directory = page.getByRole('region', { name: 'PG directory' });
    await directory.getByRole('searchbox', { name: 'Search PG or owner' }).fill('Lotus');
    await expect(directory.getByText(OWNER.pgName).first()).toBeVisible();
    await expect(page.getByText('Something went wrong')).toHaveCount(0);
  } finally {
    await bare.delete();
    await deleteApp(app);
  }
});
