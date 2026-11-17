'use client';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export interface AppUser {
  uid: string;
  phoneNumber?: string | null;
  displayName?: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if session user is active in localStorage
    const sessionUser = typeof window !== 'undefined' ? localStorage.getItem('pgpass_user_session') : null;
    if (sessionUser) {
      try {
        setUser(JSON.parse(sessionUser));
        setLoading(false);
        return;
      } catch (e) {
        // ignore
      }
    }

    try {
      const unsub = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          const u: AppUser = {
            uid: firebaseUser.uid,
            phoneNumber: firebaseUser.phoneNumber,
            displayName: firebaseUser.displayName,
          };
          setUser(u);
          if (typeof window !== 'undefined') {
            localStorage.setItem('pgpass_user_session', JSON.stringify(u));
          }
        } else {
          const stored = typeof window !== 'undefined' ? localStorage.getItem('pgpass_user_session') : null;
          if (stored) {
            try {
              setUser(JSON.parse(stored));
            } catch {
              setUser(null);
            }
          } else {
            setUser(null);
          }
        }
        setLoading(false);
      });
      return unsub;
    } catch {
      setLoading(false);
    }
  }, []);

  const loginWithPhone = (phone: string, uid?: string, displayName?: string) => {
    const cleanDigits = phone.replace(/\D/g, '');
    const userUid = uid || `owner_${cleanDigits}`;
    const u: AppUser = {
      uid: userUid,
      phoneNumber: `+91 ${cleanDigits}`,
      displayName: displayName || `PG Owner (+91 ${cleanDigits})`,
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem('pgpass_user_session', JSON.stringify(u));
    }
    setUser(u);
    return u;
  };

  const logout = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('pgpass_user_session');
    }
    try {
      await auth.signOut();
    } catch {
      // ignore
    }
    setUser(null);
  };

  return { user, loading, loginWithPhone, logout };
}
