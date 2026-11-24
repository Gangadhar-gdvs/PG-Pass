'use client';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export interface AppUser {
  uid: string;
  phoneNumber?: string | null;
  displayName?: string | null;
  email?: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          setUser({
            uid: firebaseUser.uid,
            phoneNumber: firebaseUser.phoneNumber,
            displayName: firebaseUser.displayName,
            email: firebaseUser.email,
          });

          // Proactively ensure server session cookie is active for authenticated API routes
          try {
            const idToken = await firebaseUser.getIdToken();
            fetch('/api/auth/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken }),
            }).catch(() => {});
          } catch {
            // Ignore background sync errors
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      return () => unsub();
    } catch {
      setLoading(false);
    }
  }, []);

  const logout = async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
    } catch {}
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Logout error:', e);
    }
    setUser(null);
  };

  return { user, loading, logout };
}
