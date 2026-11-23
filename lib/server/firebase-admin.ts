import 'server-only';
import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { env } from '@/lib/env';

function initFirebaseAdmin(): App {
  if (getApps().length > 0) {
    return getApp();
  }

  if (env.NEXT_PUBLIC_USE_EMULATORS) {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
    }
    if (!process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
    }
    return initializeApp({
      projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'pgpass-demo',
    });
  }

  if (env.FIREBASE_ADMIN_CREDENTIALS_B64) {
    try {
      const decodedJson = Buffer.from(
        env.FIREBASE_ADMIN_CREDENTIALS_B64,
        'base64'
      ).toString('utf-8');
      const credentials = JSON.parse(decodedJson);
      return initializeApp({
        credential: cert(credentials),
        projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      });
    } catch (err) {
      console.error('Failed to parse FIREBASE_ADMIN_CREDENTIALS_B64:', err);
    }
  }

  return initializeApp({
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'pgpass-demo',
  });
}

export const adminApp: App = initFirebaseAdmin();
export const adminAuth: Auth = getAuth(adminApp);
export const adminDb: Firestore = getFirestore(adminApp);
