import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { publicEnv } from '@/lib/env';

const firebaseConfig = {
  apiKey: publicEnv.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: publicEnv.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'pgpass-demo.firebaseapp.com',
  projectId: publicEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'pgpass-demo',
  appId: publicEnv.NEXT_PUBLIC_FIREBASE_APP_ID || '1:1234567890:web:abcdef',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);

// In development with emulators enabled, connect client SDK to emulators
if (typeof window !== 'undefined' && publicEnv.NEXT_PUBLIC_USE_EMULATORS) {
  try {
    if (!auth.emulatorConfig) {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    }
    // @ts-expect-error _settingsFrozen is an internal Firestore flag not exposed on the public type
    if (!db._settingsFrozen) {
      connectFirestoreEmulator(db, 'localhost', 8080);
    }
  } catch {
    // Ignore emulator re-connection warnings in HMR
  }
}

export default app;
