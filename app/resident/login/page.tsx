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
import { ArrowRight, Lock, Mail, User } from 'lucide-react';
import { AuthShell } from '@/components/brand/AuthShell';
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
    <AuthShell
      eyebrow="Resident Login"
      title="Your PG,"
      highlight="in your pocket."
      description="See your room, pay rent over UPI, raise maintenance requests and catch every notice — all in one place."
      bullets={['Pay rent directly to your PG over UPI', 'Raise and track maintenance requests', 'Notices and reminders, instantly']}
      illustration="hero-resident"
      footnote="Your data stays private to you and your PG"
    >
      <div className="theme-resident space-y-5">
        <div>
          <h2 className="text-[24px] font-extrabold tracking-[-0.025em] text-ink">
            {mode === 'signup' ? (
              <>
                Create your <span className="text-gradient">resident account</span>
              </>
            ) : (
              <>
                Welcome <span className="text-gradient">back</span>
              </>
            )}
          </h2>
          <p className="mt-1 text-[13px] font-medium text-muted">Access your PG, payments and issues.</p>
        </div>

        {mode === 'signup' && (
          <div className="space-y-4">
            <Input label="Your name" leading={<User />} value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
            <PhoneInput label="Phone (links you to your PG)" value={phone} onChange={setPhone} disabled={busy} />
          </div>
        )}

        <form onSubmit={handleEmail} className="space-y-4">
          <Input label="Email" type="email" leading={<Mail />} placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={busy} />
          <Input label="Password" type="password" leading={<Lock />} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={busy} />
          <Button type="submit" variant="solid" size="full" loading={busy} className="!h-12 text-[15px]">
            {mode === 'signup' ? 'Create Account' : 'Login'}
            {!busy && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>

        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-line" />
          <span className="text-xs font-semibold text-faint">or</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        <button type="button" onClick={handleGoogle} disabled={busy} className="btn-soft w-full !h-12 gap-2.5 text-sm disabled:opacity-60">
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          Continue with Google
        </button>

        <button
          type="button"
          onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}
          className="w-full text-[13px] font-bold text-brand-700 hover:underline"
        >
          {mode === 'signup' ? 'Already have an account? Login' : 'New here? Create an account'}
        </button>
      </div>
    </AuthShell>
  );
}
