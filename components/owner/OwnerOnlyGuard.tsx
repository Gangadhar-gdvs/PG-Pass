'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOwnerSession } from '@/hooks/useOwner';
import { EmptyState } from '@/components/ui/empty-state';

/**
 * Client guard for owner-only pages (Settings, Billing, Staff management).
 *
 * Staff share the owner console but must not reach these — the server already
 * rejects their writes (403), this just prevents a staff member from deep-
 * linking into a page they can't use and bounces them to the dashboard.
 */
export function OwnerOnlyGuard({ children }: { children: React.ReactNode }) {
  const { role } = useOwnerSession();
  const router = useRouter();
  const allowed = role === 'owner';

  useEffect(() => {
    if (!allowed) router.replace('/dashboard');
  }, [allowed, router]);

  if (!allowed) {
    // Shown only for the instant before the redirect lands.
    return (
      <div className="mx-auto max-w-md pt-6 animate-fade-up" role="status">
        <div className="app-card">
          <EmptyState
            illustration="shield-orbit"
            title="Owner access only"
            description="This page is only available to the PG owner. Taking you to the dashboard…"
          />
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
