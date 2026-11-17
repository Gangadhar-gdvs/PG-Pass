import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { config } from './config';

const firebaseConfig = {
  apiKey: config.firebase.apiKey || 'demo-api-key',
  authDomain: config.firebase.authDomain || 'pgpass-demo.firebaseapp.com',
  projectId: config.firebase.projectId || 'pgpass-demo',
  storageBucket: config.firebase.storageBucket || 'pgpass-demo.appspot.com',
  messagingSenderId: config.firebase.messagingSenderId || '1234567890',
  appId: config.firebase.appId || '1:1234567890:web:abcdef',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
