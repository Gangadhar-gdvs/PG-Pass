'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOwnerSession } from '@/hooks/useOwner';

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

  if (!allowed) return null;
  return <>{children}</>;
}
