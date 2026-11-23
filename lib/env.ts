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
  BACKUP_ENCRYPTION_KEY: z.string().optional(),
  CRON_SECRET: z.string().default('dev-cron-secret'),
  LOG_LEVEL: z.enum(['info', 'warn', 'error', 'debug']).default('info'),
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
});

export const serverEnv = isServer
  ? serverEnvSchema.parse(process.env)
  : ({} as z.infer<typeof serverEnvSchema>);

export const env = {
  ...publicEnv,
  ...serverEnv,
};

export default env;
