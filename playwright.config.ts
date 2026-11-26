import { defineConfig, devices } from '@playwright/test';

/**
 * Golden-path E2E suite (e2e/). Runs against an ALREADY RUNNING local stack —
 * Playwright does not start anything. Local recipe (see README → Testing):
 *
 *   firebase emulators:start --only auth,firestore --project demo-pgpass
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-pgpass \
 *   GOOGLE_APPLICATION_CREDENTIALS=<dummy service-account json> \
 *   NEXT_PUBLIC_APP_URL=http://localhost:5000 \
 *     npx next dev -p 5000 -H localhost
 *   npm run test:e2e
 *
 * Uses the system Chrome (`channel: 'chrome'`) — no Playwright browser download.
 * global-setup seeds its own e2e-* data into the demo-pgpass emulator.
 */
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5000';
const CACHE = 'node_modules/.cache/pgpass-e2e';

export default defineConfig({
  testDir: 'e2e',
  outputDir: `${CACHE}/test-results`,
  globalSetup: './e2e/global-setup.ts',
  // One worker: the suite shares one emulator + one dev server, and owner/resident
  // accounts are single-active-session, so parallel logins would supersede each other.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 20_000 },
  reporter: [['list'], ['html', { outputFolder: `${CACHE}/report`, open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    channel: 'chrome',
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 900 },
    timezoneId: 'Asia/Kolkata',
    locale: 'en-IN',
    navigationTimeout: 60_000,
    actionTimeout: 20_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    { name: 'e2e', testMatch: /.*\.spec\.ts/, dependencies: ['setup'] },
  ],
});
