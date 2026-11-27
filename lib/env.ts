import { z } from 'zod';

const publicEnvSchema = z.object({
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().default(''),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().default(''),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().default(''),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().default(''),
  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),
  NEXT_PUBLIC_USE_EMULATORS: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  NEXT_PUBLIC_SAAS_UPI_ID: z.string().optional(),
  NEXT_PUBLIC_SAAS_UPI_NAME: z.string().optional(),
  // Support contact shown to residents/owners (so they can reach the platform).
  // Overridable via env; defaults to the current support inbox.
  NEXT_PUBLIC_SUPPORT_EMAIL: z.string().default('vektorsynapse@gmail.com'),
});

const serverEnvSchema = z.object({
  APP_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  FIREBASE_ADMIN_CREDENTIALS_B64: z.string().optional(),
  B2_ENDPOINT: z.string().default('http://localhost:9000'),
  B2_REGION: z.string().default('eu-central-003'),
  B2_S3_HOST: z.string().default('localhost:9000'),
  STORAGE_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  B2_BUCKET: z.string().default('pgpass-photos'),
  B2_KEY_ID: z.string().default('minioadmin'),
  B2_APP_KEY: z.string().default('minioadmin'),
  B2_BACKUP_BUCKET: z.string().optional(),
  B2_BACKUP_KEY_ID: z.string().optional(),
  B2_BACKUP_APP_KEY: z.string().optional(),
  // AES-256 key for the nightly backup: exactly 32 bytes as 64 hex characters
  // (`openssl rand -hex 32`). Never padded/truncated. A malformed value does NOT
  // crash the app; it makes the backup cron refuse to run (see BACKUP_KEY_RE
  // below and backupKeyStatus in lib/server/backup/format.ts). Empty = unset.
  BACKUP_ENCRYPTION_KEY: z
    .string()
    .optional()
    .transform((val) => (val === '' ? undefined : val)),
  // Owner "send rent reminders from my own Gmail" (Gmail API via OAuth). All
  // three must be set to enable; otherwise the feature is hidden and reminders
  // fall back to the free WhatsApp flow. SECRETS_ENCRYPTION_KEY (32-byte, any
  // string — hashed to 32 bytes) encrypts each owner's stored refresh token.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  SECRETS_ENCRYPTION_KEY: z.string().optional(),
  CRON_SECRET: z.string().default('dev-cron-secret'),
  LOG_LEVEL: z.enum(['info', 'warn', 'error', 'debug']).default('info'),
  // Optional transactional email (Resend HTTP API). When RESEND_API_KEY is
  // unset, email sending is a silent no-op — the app stays zero-cost/card-free
  // by default and only emails when a free-tier key is provided.
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  // Optional transactional SMS (generic HTTP provider, e.g. Fast2SMS / MSG91).
  // No-op unless SMS_API_URL + SMS_API_KEY are set — keeps the app card-free by
  // default; reminders then fall back to the free "open WhatsApp" client flow.
  SMS_API_URL: z.string().optional(),
  SMS_API_KEY: z.string().optional(),
  SMS_SENDER_ID: z.string().optional(),
});

const isServer = typeof window === 'undefined';

export const publicEnv = publicEnvSchema.parse({
  NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_USE_EMULATORS: process.env.NEXT_PUBLIC_USE_EMULATORS,
  NEXT_PUBLIC_SAAS_UPI_ID: process.env.NEXT_PUBLIC_SAAS_UPI_ID,
  NEXT_PUBLIC_SAAS_UPI_NAME: process.env.NEXT_PUBLIC_SAAS_UPI_NAME,
  NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
});

export const serverEnv = isServer
  ? serverEnvSchema.parse(process.env)
  : ({} as z.infer<typeof serverEnvSchema>);

/** Mirrors lib/server/backup/format.ts BACKUP_KEY_RE (tests assert they agree). */
export const BACKUP_KEY_RE = /^[0-9a-fA-F]{64}$/;

// Fail clearly, server-side, once per process — without taking the app down.
if (isServer && serverEnv.BACKUP_ENCRYPTION_KEY !== undefined && !BACKUP_KEY_RE.test(serverEnv.BACKUP_ENCRYPTION_KEY)) {
  console.error(
    '[env] BACKUP_ENCRYPTION_KEY is set but is not exactly 64 hex characters (32 bytes). ' +
      'Nightly backups will refuse to run until it is fixed (generate one with `openssl rand -hex 32`).'
  );
}

export const env = {
  ...publicEnv,
  ...serverEnv,
};

export default env;
