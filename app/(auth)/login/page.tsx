'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, CheckCircle2, Building, Mail, Lock, AlertCircle } from 'lucide-react';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { reportClientError } from '@/lib/client/logger';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import toast from 'react-hot-toast';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isExpired = searchParams.get('expired') === 'true';
  const wasKicked = searchParams.get('kicked') === '1';
  const wasIdle = searchParams.get('idle') === '1';
  const from = searchParams.get('from') || '/dashboard';

  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  // Exchange Firebase ID token for httpOnly session cookie. Runs only AFTER
  // Firebase has verified the user's credentials, so the "log out other device"
  // prompt is shown exclusively to an authenticated user — never before.
  const establishSession = async (user: any, takeover = false) => {
    const idToken = await user.getIdToken();
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

    // Single-active-session: account is already signed in elsewhere. Only now —
    // post-authentication — do we offer to log the other device out.
    if (res.status === 409) {
      const data = await res.json().catch(() => ({}));
      if (data.code === 'ACTIVE_SESSION_EXISTS' && !takeover) {
        const proceed =
          typeof window !== 'undefined' &&
          window.confirm(
            'This account is already signed in on another device. Only one active session is allowed.\n\nLog in here and sign out the other device?'
          );
        if (!proceed) {
          // User chose to stay logged out here; the other device remains active.
          throw new Error('Sign-in cancelled — the other device is still active.');
        }
        return establishSession(user, true); // retry, taking over the session
      }
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to establish server session');
    }

    toast.success('Signed in successfully');
    router.push(from);
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      await establishSession(userCredential.user);
    } catch (err: any) {
      console.error('Google sign-in error:', err);

      // Report full technical diagnostics to system logs for admin portal
      reportClientError({
        message: err.message || 'Google sign-in failed',
        code: err.code || 'GOOGLE_SIGNIN_ERROR',
        route: '/login',
        error: err,
        details: { provider: 'google', action: 'signInWithPopup' },
      });

      // Clear, polite, non-technical message for residents and owners
      if (err.code === 'auth/operation-not-allowed') {
        setError('Google sign-in is temporarily unavailable. Please sign in with your email or contact support.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('Sign-in was cancelled.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection.');
      } else {
        setError('Unable to sign in with Google. Please try again or use your email.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      let userCredential;
      if (authMode === 'signin') {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      }
      await establishSession(userCredential.user);
    } catch (err: any) {
      console.error('Email auth error:', err);

      // Report technical diagnostics to system logs
      if (err.code !== 'auth/wrong-password' && err.code !== 'auth/user-not-found' && err.code !== 'auth/invalid-credential') {
        reportClientError({
          message: err.message || 'Email authentication failed',
          code: err.code || 'EMAIL_AUTH_ERROR',
          route: '/login',
          error: err,
          details: { mode: authMode },
        });
      }

      let msg = 'Unable to sign in. Please try again.';
      if (err.code === 'auth/operation-not-allowed') {
        msg = 'Email sign-in is temporarily unavailable. Please contact support.';
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Invalid email or password. Please try again.';
      } else if (err.code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Please sign in instead.';
      } else if (err.code === 'auth/network-request-failed') {
        msg = 'Network connection error. Please check your internet connection.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 sm:p-6 lg:p-8">
      {/* Main Container Card */}
      <div className="w-full max-w-4xl bg-white border border-[#E2E8F0] rounded-[14px] shadow-[0_20px_50px_rgba(0,0,0,0.06)] overflow-hidden grid grid-cols-1 md:grid-cols-2">
        {/* Left Brand Panel (Desktop) */}
        <div className="hidden md:flex flex-col justify-between p-10 bg-[#0F172A] text-white">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-[8px] bg-[#D97706] flex items-center justify-center text-white shadow-xs">
                <Building className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold tracking-tight text-white">PGPass</span>
            </div>

            <div className="mt-12 space-y-3">
              <h1 className="text-2xl font-bold leading-snug tracking-tight text-white">
                Bento-grade PG bed management & 0% UPI rent settlement.
              </h1>
              <p className="text-xs text-slate-400 leading-relaxed">
                Streamline bed inventory, collect rents with direct 0%-fee UPI settlement, and issue tamper-evident receipts without app downloads.
              </p>
            </div>

            <div className="mt-10 space-y-3.5">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-200">
                <CheckCircle2 className="h-4 w-4 text-[#F59E0B] shrink-0" />
                <span>Zero gateway fee direct UPI settlement</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-200">
                <CheckCircle2 className="h-4 w-4 text-[#F59E0B] shrink-0" />
                <span>PIN-protected Resident Pass links</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-200">
                <CheckCircle2 className="h-4 w-4 text-[#F59E0B] shrink-0" />
                <span>Anti-fraud UTR deduplication</span>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span>PGPass Production</span>
            <span>Secured via Firebase & B2</span>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="p-6 sm:p-10 flex flex-col justify-between bg-white text-left">
          <div>
            {/* Top Navigation */}
            <div className="flex items-center justify-between mb-8">
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748B] hover:text-[#09090B] transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Home</span>
              </Link>

              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#D97706] bg-[#FEF3C7] px-2.5 py-0.5 rounded-[6px]">
                Owner & Staff Login
              </span>
            </div>

            {isExpired && (
              <div className="mb-6 p-3 rounded-[8px] bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E]">
                Your session has expired. Please sign in to continue.
              </div>
            )}

            {wasKicked && (
              <div className="mb-6 p-3 rounded-[8px] bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E]">
                You were signed out because this account was logged in on another device.
              </div>
            )}

            {wasIdle && (
              <div className="mb-6 p-3 rounded-[8px] bg-[#FFFBEB] border border-[#FDE68A] text-xs text-[#92400E]">
                You were signed out automatically after a period of inactivity, for your security.
              </div>
            )}

            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-[#09090B] tracking-tight">
                  {authMode === 'signin' ? 'Welcome back' : 'Create an owner account'}
                </h2>
                <p className="mt-1 text-xs text-[#64748B]">
                  Sign in with Google or your email to access your PG dashboard.
                </p>
              </div>

              {/* Primary: 1-Tap Google Sign-In */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={googleLoading || loading}
                className="w-full flex items-center justify-center gap-2.5 h-11 px-4 border border-[#E2E8F0] hover:border-[#CBD5E1] bg-white hover:bg-[#F8FAFC] rounded-[8px] text-xs font-bold text-[#09090B] transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{googleLoading ? 'Connecting...' : 'Continue with Google'}</span>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-[#E2E8F0] w-full" />
                <span className="bg-white px-3 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider absolute">
                  Or with email
                </span>
              </div>

              {error && (
                <div className="p-3 rounded-[8px] bg-[#FEF2F2] border border-[#FEE2E2] flex items-center gap-2 text-xs font-semibold text-[#DC2626]">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Fallback: Email & Password */}
              <form onSubmit={handleEmailAuth} className="space-y-3.5">
                <Input
                  type="email"
                  label="Email Address"
                  placeholder="owner@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading || googleLoading}
                  required
                />

                <Input
                  type="password"
                  label="Password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading || googleLoading}
                  required
                />

                <Button
                  type="submit"
                  size="lg"
                  loading={loading}
                  variant="solid"
                  className="w-full text-[13px] mt-2"
                >
                  {authMode === 'signin' ? 'Sign In' : 'Create Account'}
                </Button>
              </form>

              <div className="pt-2 text-center text-xs text-[#64748B]">
                {authMode === 'signin' ? (
                  <span>
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signup');
                        setError('');
                      }}
                      className="font-bold text-[#D97706] hover:underline cursor-pointer"
                    >
                      Sign up
                    </button>
                  </span>
                ) : (
                  <span>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('signin');
                        setError('');
                      }}
                      className="font-bold text-[#D97706] hover:underline cursor-pointer"
                    >
                      Sign in
                    </button>
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-[#E2E8F0] flex items-center justify-center gap-1.5 text-[11px] text-[#94A3B8]">
            <ShieldCheck className="h-3.5 w-3.5 text-[#10B981]" />
            <span>Secure httpOnly session cookies</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-[#D97706] border-t-transparent animate-spin" />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
