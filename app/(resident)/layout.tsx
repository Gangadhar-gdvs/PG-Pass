import React from 'react';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/server/auth/session';
import { ResidentShell } from './ResidentShell';

/**
 * Server-gated layout for the resident panel. Verifies the session cookie and
 * that the user is a resident before any HTML ships.
 */
export default async function ResidentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerUser();
  if (!user || user.role !== 'resident') {
    redirect('/resident/login');
  }
  return <ResidentShell>{children}</ResidentShell>;
}
