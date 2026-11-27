'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '@/lib/utils';
import { apiGet, PermissionDeniedError } from '@/lib/client/api';

export { PermissionDeniedError };

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  /** User-facing error message, or null. Distinct from `data === null`. */
  error: string | null;
  /** 'permission-denied' when the loader threw a PermissionDeniedError. */
  denied: boolean;
  /** Re-run the loader (e.g. a Retry button or after a mutation). */
  reload: () => void;
}

/**
 * Standard data-loading hook for client pages. Replaces the boilerplate that was
 * copy-pasted into ~14 files:
 *
 *   setLoading(true); try { const r = await fetch(); if (r.ok) setX(...) }
 *   catch { /* non-fatal *\/ } finally { setLoading(false) }
 *
 * — which silently swallowed failures and rendered an empty page with no error
 * and no retry. This hook captures the error, exposes `reload`, guards against
 * setState after unmount / a superseded reload, and defers the initial fetch to a
 * microtask (so the mount setState isn't in the effect body — cascading-render
 * lint rule). On failure the page can show a real error + Retry.
 *
 *   const { data, loading, error, reload } = useAsyncData(
 *     async () => (await fetchJson('/api/tasks')).tasks as Task[],
 *     [ownerId],
 *     { enabled: !!ownerId },
 *   );
 */
export function useAsyncData<T>(
  loader: () => Promise<T>,
  deps: React.DependencyList = [],
  opts: { enabled?: boolean } = {}
): AsyncState<T> {
  const enabled = opts.enabled ?? true;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  // Keep the latest loader without making it a dependency (callers pass inline
  // arrows that change identity every render). Updated in an effect, not during
  // render (react-hooks/refs): the run is itself deferred to a microtask after
  // commit, so it always reads the committed loader.
  const loaderRef = useRef(loader);
  useEffect(() => {
    loaderRef.current = loader;
  });

  // Monotonic run id so a slow earlier load can't overwrite a newer one.
  const runIdRef = useRef(0);

  const run = useCallback(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const myRun = ++runIdRef.current;
    setLoading(true);
    setError(null);
    setDenied(false);
    loaderRef.current()
      .then((result) => {
        if (myRun !== runIdRef.current) return; // superseded
        setData(result);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (myRun !== runIdRef.current) return;
        if (e instanceof PermissionDeniedError) {
          setDenied(true);
          setError(null);
        } else {
          setError(errorMessage(e, "Couldn't load. Please try again."));
        }
        setLoading(false);
      });
  }, [enabled]);

  const reload = useCallback(() => {
    // Defer so a click/handler-triggered reload's setState isn't surprising.
    queueMicrotask(run);
  }, [run]);

  useEffect(() => {
    // Invalidate any in-flight run from the previous deps, then load.
    runIdRef.current++;
    let active = true;
    queueMicrotask(() => {
      if (active) run();
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { data, loading, error, denied, reload };
}

/**
 * GET + JSON via the shared client API layer — throws a usable message on a
 * non-ok response and a `PermissionDeniedError` on 403, so `useAsyncData` can
 * distinguish "no access" from an outage. Thin alias kept for call-site brevity.
 */
export function fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  return apiGet<T>(url, init);
}
