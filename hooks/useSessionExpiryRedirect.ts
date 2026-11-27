'use client';

import { useEffect } from 'react';
import { addResponseInterceptor } from '@/lib/client/api';

/**
 * Wires the client API layer so that a 401 from ANY `/api/*` call (an expired /
 * missing / superseded session cookie) reloads the page once — which hits the
 * server-gated layout and redirects to the correct role login (owner → /login,
 * resident → /resident/login). Without this, an expired session only showed
 * "Your session has expired" toasts and the user stayed stuck on a page that
 * kept failing until they navigated manually.
 *
 * Guards:
 *  - Only reacts to 401 (session), never 403 (permission — that's a real
 *    "no access" state the UI handles inline, not a reason to sign out).
 *  - Reloads AT MOST ONCE per tab (sessionStorage flag) so a 401 during the
 *    reload itself can't loop; the flag clears on a fresh successful load.
 *  - Skips when already on a login/auth page.
 */
export function useSessionExpiryRedirect(): void {
  useEffect(() => {
    const FLAG = 'pgp_session_expired_reload';
    const onLoginPage = () =>
      /\/login(\/|$|\?)|\/admin(\/|$|\?)/.test(window.location.pathname + window.location.search);

    const unregister = addResponseInterceptor((res) => {
      // A successful API call means the session is valid again — clear the guard
      // so the NEXT genuine expiry can reload. (Clearing on mount would risk a
      // loop: reload → mount → next call still 401s → guard cleared → reload…)
      if (res.ok) {
        try {
          sessionStorage.removeItem(FLAG);
        } catch {
          /* ignore */
        }
        return;
      }
      if (res.status !== 401) return;
      if (onLoginPage()) return;
      // Reload once; the flag prevents a loop if the post-reload load also 401s
      // before the layout's server-side redirect fires.
      if (sessionStorage.getItem(FLAG)) return;
      try {
        sessionStorage.setItem(FLAG, '1');
      } catch {
        /* storage blocked — still attempt the reload below */
      }
      window.location.reload();
    });

    return unregister;
  }, []);
}
