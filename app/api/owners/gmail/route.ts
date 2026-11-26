import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { getOwnerGmailStatus, disconnectOwnerGmail } from '@/lib/server/services/gmail.service';

// GET: current owner's Gmail connection status (available/connected/email).
export const GET = withErrorHandler(
  withAuth(
    async (_req: NextRequest, ctx: { auth: AuthContext }) => {
      const status = await getOwnerGmailStatus(ctx.auth.uid);
      return NextResponse.json(status);
    },
    { roles: ['owner'] }
  )
);

// DELETE: disconnect Gmail for this owner.
export const DELETE = withErrorHandler(
  withAuth(
    async (_req: NextRequest, ctx: { auth: AuthContext }) => {
      await disconnectOwnerGmail(ctx.auth.uid);
      return NextResponse.json({ success: true });
    },
    { roles: ['owner'] }
  )
);
