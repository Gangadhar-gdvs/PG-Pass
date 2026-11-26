import path from 'node:path';
import { expect, type Page } from '@playwright/test';

/**
 * E2E-only identities and data. Everything is namespaced `e2e-*` so the suite
 * never collides with the manual dev seed (Green Valley PG / owner-gv) and
 * global-setup can wipe + reseed it idempotently on every run.
 */
export const PROJECT_ID = 'demo-pgpass';
export const PASSWORD = 'E2e@PgPass2026';

export const OWNER = {
  uid: 'e2e-owner-1',
  email: 'e2e.owner@pgpass-e2e.test',
  name: 'Meera Iyer',
  pgName: 'E2E Lotus Residency',
  pgAddress: 'Plot 7, Kondapur, Hyderabad',
};
export const ADMIN = { uid: 'e2e-admin-1', email: 'e2e.admin@pgpass-e2e.test', name: 'E2E Platform Admin' };
export const RESIDENT_ACCOUNT = {
  uid: 'e2e-resident-1',
  email: 'e2e.resident@pgpass-e2e.test',
  name: 'Ravi Resident',
  phone: '9000033333',
};

/** Seeded beds (4 total: 2 occupied, 2 vacant). */
export const BEDS = [
  { id: 'e2e-bed-101a', floor: 1, room: '101', label: '101-A', rent: 8000, tenant: 'e2e-t-rent' },
  { id: 'e2e-bed-101b', floor: 1, room: '101', label: '101-B', rent: 8000, tenant: 'e2e-t-portal' },
  { id: 'e2e-bed-102a', floor: 1, room: '102', label: '102-A', rent: 9000, tenant: null },
  { id: 'e2e-bed-102b', floor: 1, room: '102', label: '102-B', rent: 9000, tenant: null },
] as const;

/** Raw resident-pass tokens (portal_tokens stores only their SHA-256, as the app does). */
export const TENANTS = {
  'e2e-t-rent': { name: 'Kiran Rao', phone: '9000011111', token: 'e2eKiranPortalToken_Hq4Tz8Nw2Lm6Pv9Xc3Rb7Ys1Df' },
  'e2e-t-portal': { name: 'Divya Nair', phone: '9000022222', token: 'e2eDivyaPortalToken_x7Qm2Lr9Vt4Kp8Wn3Zs6Hc1Jb5' },
} as const;

export const PORTAL_TOKEN = TENANTS['e2e-t-portal'].token;
export const PORTAL_PIN = TENANTS['e2e-t-portal'].phone.slice(-4);

/** Open maintenance ticket raised by Divya (owner moves it through the workflow). */
export const TICKET = { id: 'e2e-ticket-1', description: 'E2E: bathroom tap in 101-B is leaking' };

/** Billing period as the browser computes it (getCurrentPeriod, Asia/Kolkata). */
export function currentPeriodIST(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' })
    .formatToParts(now);
  const y = parts.find((p) => p.type === 'year')!.value;
  const m = parts.find((p) => p.type === 'month')!.value;
  return `${y}-${m}`;
}

/** Storage state (cookies + Firebase IndexedDB auth) produced by owner.setup.ts. */
export const AUTH_DIR = path.resolve(__dirname, '../node_modules/.cache/pgpass-e2e/auth');
export const OWNER_STATE = path.join(AUTH_DIR, 'owner.json');

/**
 * Sign in through a real email/password form. Owner/resident accounts are
 * single-active-session: if the server reports another live session, the app
 * shows a "Signed in on another device" confirm — accept it ("Log in here").
 */
export async function signInViaForm(
  page: Page,
  opts: { email: string; password?: string; emailLabel?: RegExp; passwordLabel?: RegExp; submit?: RegExp }
) {
  await page.getByLabel(opts.emailLabel ?? /^email address/i).fill(opts.email);
  await page.getByLabel(opts.passwordLabel ?? /^password/i).fill(opts.password ?? PASSWORD);
  await page.getByRole('button', { name: opts.submit ?? /^sign in$/i }).click();
  const takeover = page.getByRole('button', { name: /log in here/i });
  // Either we navigate away, or the takeover confirm appears.
  await expect
    .poll(async () => (await takeover.isVisible().catch(() => false)) || !page.url().includes('/login'), {
      timeout: 30_000,
    })
    .toBe(true);
  if (await takeover.isVisible().catch(() => false)) await takeover.click();
}
