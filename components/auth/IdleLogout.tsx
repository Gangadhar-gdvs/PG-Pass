'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { clearLocalData } from '@/lib/client/localData';
import { IDLE_TIMEOUT_MINUTES, IDLE_WARNING_SECONDS } from '@/lib/constants/limits';
import { Icon3D } from '@/components/brand/Icon3D';

/**
 * Idle auto-logout. After `IDLE_TIMEOUT_MINUTES[role]` of no user activity, the
 * session is ended for safety (privileged roles time out sooner). A warning with
 * a "Stay signed in" button appears `IDLE_WARNING_SECONDS` before logout so the
 * user doesn't lose work. On logout: server session cleared, Firebase signed
 * out, and all app-owned LOCAL storage wiped (never DB/server data).
 *
 * Activity = pointer/keyboard/scroll/touch/visibility. The timer resets on any.
 */
export function IdleLogout({
  role,
  redirectTo,
}: {
  role: string;
  redirectTo: string;
}) {
  const timeoutMs = (IDLE_TIMEOUT_MINUTES[role] ?? 30) * 60_000;
  const warnMs = IDLE_WARNING_SECONDS * 1000;

  const [warning, setWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(IDLE_WARNING_SECONDS);
  const warnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdown = useRef<ReturnType<typeof setInterval> | null>(null);
  const loggingOut = useRef(false);

  const doLogout = useCallback(async () => {
    if (loggingOut.current) return;
    loggingOut.current = true;
    try {
      await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
      await signOut(auth).catch(() => {});
    } finally {
      clearLocalData();
      if (typeof window !== 'undefined') {
        window.location.href = new URL(`${redirectTo}?idle=1`, window.location.origin).href;
      }
    }
  }, [redirectTo]);

  const clearTimers = () => {
    if (warnTimer.current) clearTimeout(warnTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    if (countdown.current) clearInterval(countdown.current);
  };

  // Live mirror of `warning` so the (mount-once) activity listener reads the
  // current value WITHOUT being a hook dependency — the previous version put
  // the activity callback in the effect deps, so the effect re-ran the instant
  // the warning appeared and immediately re-armed/cancelled it (auto-logout
  // never actually fired). Refs keep the effect stable for the component's life.
  const warningRef = useRef(false);
  // Write the ref AFTER commit (not during render) to satisfy the refs-purity
  // rule; the activity listener reads it asynchronously so one frame's lag is fine.
  useEffect(() => {
    warningRef.current = warning;
  }, [warning]);

  const armTimers = useCallback(() => {
    clearTimers();
    setWarning(false);
    // Warning fires first…
    warnTimer.current = setTimeout(() => {
      setWarning(true);
      setSecondsLeft(IDLE_WARNING_SECONDS);
      countdown.current = setInterval(() => {
        setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
      }, 1000);
    }, Math.max(0, timeoutMs - warnMs));
    // …then the actual logout.
    logoutTimer.current = setTimeout(doLogout, timeoutMs);
  }, [timeoutMs, warnMs, doLogout]);

  // Keep the latest armTimers in a ref so the mount-once effect never needs it
  // as a dependency.
  const armRef = useRef(armTimers);
  // Keep the ref current AFTER commit (not during render) per the refs-purity
  // rule; the mount-once effect below calls armRef.current() asynchronously.
  useEffect(() => {
    armRef.current = armTimers;
  }, [armTimers]);

  useEffect(() => {
    armRef.current();
    // Ignore activity while the warning is shown — the user must explicitly
    // click "Stay signed in"; an accidental touch must not extend the session.
    const onActivity = () => {
      if (warningRef.current) return;
      armRef.current();
    };
    const events: (keyof WindowEventMap)[] = [
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'pointerdown',
    ];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !warningRef.current) armRef.current();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimers();
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener('visibilitychange', onVisible);
    };
    // Mount-once: timers + listeners live for the component's lifetime; the
    // latest warning/armTimers are read via refs, so no deps are needed.
  }, []);

  const stay = () => {
    setWarning(false);
    armTimers();
  };

  if (!warning) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-3 sm:p-4" role="alertdialog" aria-modal="true" aria-labelledby="idle-title">
      <div className="fixed inset-0 bg-[#1A1458]/40 backdrop-blur-[3px] animate-fade" aria-hidden="true" />
      <div className="relative w-full max-w-sm overflow-hidden rounded-[28px] border border-white bg-[linear-gradient(180deg,#FFFFFF_0%,#F5F0FF_100%)] p-6 text-center shadow-[0_30px_70px_-24px_rgba(40,20,120,0.55)] animate-pop">
        <div aria-hidden className="pointer-events-none absolute -top-14 -right-12 h-40 w-40 rounded-full bg-[#D9C6FF]/50 blur-3xl" />
        <div className="relative mx-auto grid h-24 w-24 place-items-center">
          <Icon3D name="clock" size={44} className="absolute -top-1 -right-1 opacity-90" />
          <span className="grid h-20 w-20 place-items-center rounded-full bg-[image:var(--grad-brand)] text-white shadow-[var(--shadow-brand)]">
            <span className="text-[26px] font-extrabold font-mono-numbers leading-none">{secondsLeft}s</span>
          </span>
        </div>
        <h2 id="idle-title" className="relative mt-3 text-lg font-extrabold text-ink tracking-[-0.015em]">Still there?</h2>
        <p className="relative mt-1.5 text-sm text-ink-2/80 leading-relaxed">
          You&apos;ll be signed out shortly for your security. Your data stays safe.
        </p>
        <div className="relative mt-6 grid grid-cols-[1fr_auto] gap-2.5">
          <button onClick={stay} className="btn-pill w-full">
            Stay signed in
          </button>
          <button onClick={doLogout} className="btn-soft">
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
