import 'server-only';
import dns from 'dns';
import { initializeApp, getApps, getApp, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { env } from '@/lib/env';

// Enforce IPv4 lookup order to eliminate Windows/ISP IPv6 hanging and 120s connection timeouts
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  // Gracefully ignore if runtime does not support
}

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
try {
  adminDb.settings({
    ignoreUndefinedProperties: true,
    // `preferRest` makes Firestore use HTTP/1.1 REST instead of gRPC. On
    // serverless (Vercel), the default gRPC transport must open an HTTP/2
    // channel on every cold start — a slow, cross-region handshake that
    // dominated login/first-load latency. This app does a handful of short
    // reads per request, which REST serves far faster with no channel warm-up.
    // Not against the local emulators: the REST transport insists on Google
    // application-default credentials ("Could not load the default credentials")
    // while the gRPC transport talks to the emulator unauthenticated.
    preferRest: !env.NEXT_PUBLIC_USE_EMULATORS,
  });
} catch {
  // Settings already frozen or initialized
}
