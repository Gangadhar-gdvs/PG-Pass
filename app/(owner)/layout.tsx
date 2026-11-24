import React from 'react';
import { redirect } from 'next/navigation';
import { getServerUser } from '@/lib/server/auth/session';
import { OwnerShell } from './OwnerShell';

/**
 * Server Component auth gate for the whole owner area.
 *
 * The `__session` cookie is verified on the server before any HTML is sent, so
 * an unauthenticated visitor is redirected to /login with zero client JS, and
 * an authenticated owner gets the shell + `uid`/`ownerId` immediately — no more
 * full-screen "Loading Dashboard…" spinner while the client waits on
 * `onAuthStateChanged`, which was the dominant first-paint delay on mobile.
 */
export default async function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerUser();

  // Owners and staff operate the owner console; admins have their own /admin.
  if (!user || (user.role !== 'owner' && user.role !== 'staff')) {
    redirect('/login');
  }

  const session = {
    uid: user.uid,
    role: user.role,
    ownerId: user.ownerId || user.uid,
    email: user.email,
    phoneNumber: user.phoneNumber,
  };

  return <OwnerShell session={session}>{children}</OwnerShell>;
}
