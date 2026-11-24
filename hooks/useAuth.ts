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

          // Proactively keep the server session cookie fresh for API routes.
          // This is a BACKGROUND refresh (mode: 'refresh') — it must never take
          // over an account logged in on another device. If the server says
          // this device was superseded, sign out locally.
          try {
            const idToken = await firebaseUser.getIdToken();
            const res = await fetch('/api/auth/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken, mode: 'refresh' }),
            });
            if (res.status === 409) {
              const data = await res.json().catch(() => ({}));
              if (data.code === 'SESSION_SUPERSEDED') {
                await signOut(auth).catch(() => {});
                setUser(null);
                setLoading(false);
                if (typeof window !== 'undefined') {
                  window.location.href = '/login?kicked=1';
                }
                return;
              }
            }
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
