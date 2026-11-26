'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowRight, Lock, Mail } from 'lucide-react';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  type User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { reportClientError } from '@/lib/client/logger';
import { errorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InfoBanner } from '@/components/ui/dashboard-kit';
import { AuthShell, AuthLoader } from '@/components/brand/AuthShell';
import { Icon3D } from '@/components/brand/Icon3D';
import toast from 'react-hot-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';

/** Narrow an unknown caught value to the Firebase auth error `code` string. */
function authErrorCode(e: unknown): string {
  if (e && typeof e === 'object' && 'code' in e) {
    const c = (e as { code?: unknown }).code;
    if (typeof c === 'string') return c;
  }
  return '';
}

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
  // True from the moment the session is established until the destination page
  // takes over. Keeps a full-screen loader on top of the (now stale) login form
  // so the user never stares at the old page during the server round-trip.
  const [redirecting, setRedirecting] = useState(false);
  const [askConfirm, confirmDialogEl] = useConfirm();

  // Exchange Firebase ID token for httpOnly session cookie. Runs only AFTER
  // Firebase has verified the user's credentials, so the "log out other device"
  // prompt is shown exclusively to an authenticated user — never before.
  const establishSession = async (user: User, takeover = false) => {
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
        const proceed = await askConfirm({
          title: 'Signed in on another device',
          message: 'Only one active session is allowed. Log in here and sign out the other device?',
          confirmLabel: 'Log in here',
          tone: 'default',
        });
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

    // Route by the server-verified role, NOT by `from`. The owner login is a
    // shared entry point, so an admin or resident who signs in here must be sent
    // to their own console instead of defaulting into the owner dashboard.
    const data = await res.json().catch(() => ({}));
    const role: string = data.role || 'owner';

    toast.success('Signed in successfully');

    // Show the full-screen loader NOW — the destination is a server-rendered
    // page that must verify the session before it can paint, so without this the
    // user would keep seeing the stale login form during that round-trip.
    setRedirecting(true);

    let dest = '/dashboard';
    if (role === 'admin') {
      dest = '/admin';
    } else if (role === 'resident' || role === 'tenant') {
      dest = '/resident/home';
    } else {
      // Owner / staff: honour the requested page, but never let an admin-only
      // destination leak through `from`.
      dest = from.startsWith('/admin') ? '/dashboard' : from;
    }
    router.replace(dest);
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      await establishSession(userCredential.user);
    } catch (err: unknown) {
      console.error('Google sign-in error:', err);
      const code = authErrorCode(err);

      // Report full technical diagnostics to system logs for admin portal
      reportClientError({
        message: errorMessage(err, 'Google sign-in failed'),
        code: code || 'GOOGLE_SIGNIN_ERROR',
        route: '/login',
        error: err,
        details: { provider: 'google', action: 'signInWithPopup' },
      });

      // Clear, polite, non-technical message for residents and owners
      if (code === 'auth/operation-not-allowed') {
        setError('Google sign-in is temporarily unavailable. Please sign in with your email or contact support.');
      } else if (code === 'auth/popup-closed-by-user') {
        setError('Sign-in was cancelled.');
      } else if (code === 'auth/network-request-failed') {
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
    } catch (err: unknown) {
      console.error('Email auth error:', err);
      const code = authErrorCode(err);

      // Report technical diagnostics to system logs
      if (code !== 'auth/wrong-password' && code !== 'auth/user-not-found' && code !== 'auth/invalid-credential') {
        reportClientError({
          message: errorMessage(err, 'Email authentication failed'),
          code: code || 'EMAIL_AUTH_ERROR',
          route: '/login',
          error: err,
          details: { mode: authMode },
        });
      }

      let msg = 'Unable to sign in. Please try again.';
      if (code === 'auth/operation-not-allowed') {
        msg = 'Email sign-in is temporarily unavailable. Please contact support.';
      } else if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        msg = 'Invalid email or password. Please try again.';
      } else if (code === 'auth/email-already-in-use') {
        msg = 'An account with this email already exists. Please sign in instead.';
      } else if (code === 'auth/network-request-failed') {
        msg = 'Network connection error. Please check your internet connection.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (redirecting) {
    return <AuthLoader />;
  }

  return (
    <AuthShell
      eyebrow="Owner & Staff Login"
      title="Smart PG Management,"
      highlight="Made Easy!"
      description="Manage rooms, beds, residents, rent and maintenance — with rent paid straight to your bank over UPI."
      bullets={['Zero-fee direct UPI rent settlement', 'PIN-protected resident pass links', 'Anti-fraud UTR deduplication']}
      illustration="hero-landing"
      footnote="Secure httpOnly session cookies"
    >
      <div className="space-y-5">
        {isExpired && (
          <InfoBanner tone="warning" title="Session expired" description="Your session has expired. Please sign in to continue." />
        )}
        {wasKicked && (
          <InfoBanner
            tone="warning"
            title="Signed out on this device"
            description="You were signed out because this account was logged in on another device."
          />
        )}
        {wasIdle && (
          <InfoBanner
            tone="info"
            icon="clock"
            title="Signed out for your security"
            description="You were signed out automatically after a period of inactivity, for your security."
          />
        )}

        <div>
          <h2 className="text-[24px] font-extrabold tracking-[-0.025em] text-ink">
            {authMode === 'signin' ? (
              <>
                Welcome <span className="text-gradient">back</span>
              </>
            ) : (
              <>
                Create an <span className="text-gradient">owner account</span>
              </>
            )}
          </h2>
          <p className="mt-1 text-[13px] font-medium text-muted">
            Sign in with Google or your email to access your PG dashboard.
          </p>
        </div>

        {/* Primary: 1-Tap Google Sign-In */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
          className="btn-soft w-full !h-12 gap-2.5 text-sm disabled:opacity-60"
        >
          <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden="true">
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

        <div className="flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-line" />
          <span className="text-xs font-semibold text-faint">or with email</span>
          <span className="h-px flex-1 bg-line" />
        </div>

        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-2xl bg-danger-bg px-3.5 py-3 text-[13px] font-semibold text-danger-ink animate-shake">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Fallback: Email & Password */}
        <form onSubmit={handleEmailAuth} className="space-y-4">
          <Input
            type="email"
            label="Email address"
            placeholder="owner@example.com"
            leading={<Mail />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading || googleLoading}
            required
          />

          <Input
            type="password"
            label="Password"
            placeholder="••••••••"
            leading={<Lock />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading || googleLoading}
            required
          />

          <Button type="submit" size="full" loading={loading} variant="solid" className="!h-12 text-[15px]">
            {authMode === 'signin' ? 'Sign In' : 'Create Account'}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>

        <div className="text-center text-[13px] font-medium text-muted">
          {authMode === 'signin' ? (
            <span>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setAuthMode('signup');
                  setError('');
                }}
                className="font-bold text-brand-700 hover:underline cursor-pointer"
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
                className="font-bold text-brand-700 hover:underline cursor-pointer"
              >
                Sign in
              </button>
            </span>
          )}
        </div>

        <Link
          href="/resident/login"
          className="flex items-center gap-3 rounded-2xl tint-card tint-sky px-4 py-3 press"
        >
          <Icon3D name="home-blue" size={34} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-ink">Staying at a PG?</span>
            <span className="block text-xs font-medium text-ink-2/75">Resident sign-in is over here</span>
          </span>
          <ArrowRight className="h-4 w-4 text-brand" />
        </Link>
      </div>
      {confirmDialogEl}
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={<AuthLoader title="Loading…" subtitle="" />}
    >
      <LoginFormContent />
    </Suspense>
  );
}
