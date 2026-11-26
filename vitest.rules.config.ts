import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * Firestore security-rules suite. Needs a running Firestore emulator, so it is
 * kept OUT of the default `npm test` (vitest.config.ts only includes tests/unit).
 *
 *   npm run test:rules          # boots a throwaway emulator via `firebase emulators:exec`
 *   npm run test:rules:running  # reuses an emulator you already started (default 127.0.0.1:8080)
 *
 * Each test file uses its own `demo-rules-*` project id, so it never touches the
 * app's `demo-pgpass` data even when pointed at the shared dev emulator.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
