import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';

// The signed-in admin's own tier + permissions, so the console can show/hide
// tabs and the Admins panel. No adminPermission gate — any active admin may read
// their own entitlements (withAuth already blocked suspended/non-admins).
export const GET = withErrorHandler(
  withAuth(
    async (_req, ctx: { auth: AuthContext }) => {
      return NextResponse.json({
        uid: ctx.auth.uid,
        email: ctx.auth.email,
        adminRole: ctx.auth.adminRole,
        permissions: ctx.auth.adminPermissions || [],
      });
    },
    { roles: ['admin'] }
  )
);
