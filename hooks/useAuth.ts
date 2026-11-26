'use client';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { clearLocalData } from '@/lib/client/localData';

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
          //
          // THROTTLED: the session cookie is valid for days and the shell is
          // already server-gated, so there's no need to hit the server on every
          // navigation. We refresh at most once every few minutes — enough to
          // detect a "signed out on another device" takeover promptly without
          // firing redundant Firebase round-trips that slow each page load.
          try {
            const REFRESH_INTERVAL_MS = 5 * 60_000;
            const lastKey = 'pgp_last_session_refresh';
            const last = Number(sessionStorage.getItem(lastKey) || 0);
            if (Date.now() - last < REFRESH_INTERVAL_MS) {
              setLoading(false);
              return;
            }

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
                  window.location.href = new URL('/login?kicked=1', window.location.origin).href;
                }
                return;
              }
            }
            // Record the throttle timestamp ONLY after a completed refresh — if the
            // request failed/offline we must retry on the next mount, not suppress
            // takeover detection for 5 minutes on a request that never succeeded.
            sessionStorage.setItem(lastKey, String(Date.now()));
          } catch {
            // Ignore background sync errors (timestamp intentionally NOT written,
            // so the next navigation retries the refresh).
          }
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      return () => unsub();
    } catch {
      // Defer so this synchronous-path setState isn't called in the effect body
      // (cascading-render lint rule). Only hit if onAuthStateChanged throws sync.
      queueMicrotask(() => setLoading(false));
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
    // Wipe app-owned local/session storage (selected property, portal PINs).
    clearLocalData();
    setUser(null);
  };

  return { user, loading, logout };
}
