'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import { Icon3D } from '@/components/brand/Icon3D';
import { reportClientError } from '@/lib/client/logger';

/**
 * Route-level error boundary in the app's visual style. Users see a calm,
 * actionable message (never a stack trace); the technical error goes to the
 * centralized logger for the admin dashboard.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void reportClientError({
      message: error.message || 'Unhandled route error',
      code: 'ROUTE_ERROR_BOUNDARY',
      route: typeof window !== 'undefined' ? window.location.pathname : undefined,
      details: error.digest ? { digest: error.digest } : undefined,
      error,
    });
  }, [error]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-10">
      <div className="app-card w-full max-w-md rounded-[30px] px-6 py-8 text-center shadow-[var(--shadow-float)]">
        <span className="icon-bubble tint-peach mx-auto" style={{ width: 84, height: 84 }}>
          <Icon3D name="alert" size={50} />
        </span>
        <h1 className="mt-4 text-xl font-extrabold text-ink">Something went wrong</h1>
        <p className="mt-1.5 text-sm font-medium text-muted">
          We couldn’t load this screen. Please try again — your data is safe.
        </p>
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <button type="button" onClick={reset} className="btn-pill">
            <RotateCcw className="h-4 w-4" /> Try again
          </button>
          <Link href="/" className="btn-soft">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
