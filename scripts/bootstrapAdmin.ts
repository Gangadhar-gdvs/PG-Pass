import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

// Native environment variable loading from .env.local and .env
function loadEnv() {
  if (typeof (process as any).loadEnvFile === 'function') {
    try {
      (process as any).loadEnvFile(path.resolve(process.cwd(), '.env.local'));
    } catch {}
    try {
      (process as any).loadEnvFile(path.resolve(process.cwd(), '.env'));
    } catch {}
    return;
  }

  for (const file of ['.env.local', '.env']) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...values] = trimmed.split('=');
          const value = values.join('=').replace(/^["']|["']$/g, '');
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = value.trim();
          }
        }
      });
    }
  }
}

loadEnv();

const uid = process.argv[2];

if (!uid) {
  console.error('Usage: npx tsx scripts/bootstrapAdmin.ts <firebase-user-uid>');
  process.exit(1);
}

async function bootstrap() {
  const isEmulator = process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';

  if (isEmulator) {
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
  }

  const app =
    getApps().length === 0
      ? initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'pgpass-demo',
        })
      : getApps()[0];

  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log(`Setting custom claim { admin: true } for UID: ${uid}...`);
  await auth.setCustomUserClaims(uid, { admin: true });

  console.log('Writing audit log...');
  await db.collection('audit_logs').add({
    actorUid: 'cli_bootstrap',
    actorRole: 'system',
    action: 'bootstrap_super_admin',
    targetType: 'user',
    targetId: uid,
    reason: 'Initial platform super admin bootstrap',
    createdAt: Timestamp.now(),
  });

  console.log(`✅ Successfully bootstrapped UID ${uid} as Super Admin!`);
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
