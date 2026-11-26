'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/phone-input';
import { validatePhone } from '@/lib/security';
import { errorMessage } from '@/lib/utils';
import { UserCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ResidentLoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  // After Firebase auth: (optionally) register as resident, then mint session.
  const finish = async (idToken: string, isNew: boolean) => {
    if (isNew) {
      const pv = validatePhone(phone);
      if (!pv.valid) throw new Error(pv.error || 'Enter a valid 10-digit phone');
      const reg = await fetch('/api/resident/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, name: name.trim(), phone: pv.cleaned, email }),
      });
      if (!reg.ok) {
        const e = await reg.json().catch(() => ({}));
        throw new Error(e.error || e.message || 'Registration failed');
      }
      // Re-fetch token to pick up the new resident claim.
      idToken = await auth.currentUser!.getIdToken(true);
    }
    await mintSession(idToken, false);
    router.push('/resident/home');
  };

  // Single-active-session: mint the server session for this (verified) resident.
  // If the account is already active on another device, confirm takeover first
  // — shown only post-authentication, never before.
  const mintSession = async (idToken: string, takeover: boolean): Promise<void> => {
    const res = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken,
        mode: 'login',
        takeover,
        device: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      }),
    });
    if (res.status === 409) {
      const data = await res.json().catch(() => ({}));
      if (data.code === 'ACTIVE_SESSION_EXISTS' && !takeover) {
        const proceed =
          typeof window !== 'undefined' &&
          window.confirm(
            'This account is already signed in on another device. Only one active session is allowed.\n\nLog in here and sign out the other device?'
          );
        if (!proceed) throw new Error('Sign-in cancelled — the other device is still active.');
        return mintSession(idToken, true);
      }
    }
    if (!res.ok) throw new Error('Could not start session');
  };

  const handleGoogle = async () => {
    setBusy(true);
    try {
      if (mode === 'signup') {
        const pv = validatePhone(phone);
        if (!pv.valid) throw new Error('Enter your phone number first');
        if (name.trim().length < 2) throw new Error('Enter your name first');
      }
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      const idToken = await cred.user.getIdToken();
      await finish(idToken, mode === 'signup');
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Google sign-in failed'));
    } finally {
      setBusy(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const cred =
        mode === 'signup'
          ? await createUserWithEmailAndPassword(auth, email.trim(), password)
          : await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await cred.user.getIdToken();
      await finish(idToken, mode === 'signup');
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Sign-in failed').replace('Firebase:', '').trim() || 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="theme-resident min-h-screen bg-[#F0FDFA] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm app-card rounded-[16px] shadow-[var(--shadow-card)] p-6 space-y-5">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 mx-auto rounded-[12px] accent-bg text-white flex items-center justify-center">
            <UserCircle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold">Resident {mode === 'signup' ? 'Sign Up' : 'Login'}</h1>
          <p className="text-xs text-[#64748B]">Access your PG, payments and issues.</p>
        </div>

        {mode === 'signup' && (
          <>
            <Input label="Your Name" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
            <PhoneInput label="Phone (links you to your PG)" value={phone} onChange={setPhone} disabled={busy} />
          </>
        )}

        <form onSubmit={handleEmail} className="space-y-3">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={busy} />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={busy} />
          <Button type="submit" variant="solid" loading={busy} className="w-full">
            {mode === 'signup' ? 'Create Account' : 'Login'}
          </Button>
        </form>

        <div className="relative text-center">
          <span className="text-[11px] text-[#94A3B8] bg-white px-2 relative z-10">or</span>
          <div className="absolute inset-x-0 top-1/2 h-px bg-[#E2E8F0]" />
        </div>

        <Button variant="outline" onClick={handleGoogle} disabled={busy} className="w-full">
          Continue with Google
        </Button>

        <button
          type="button"
          onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
          className="w-full text-xs accent-text font-semibold"
        >
          {mode === 'signup' ? 'Already have an account? Login' : 'New here? Create an account'}
        </button>
      </div>
    </div>
  );
}
