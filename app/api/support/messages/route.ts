import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { supportService } from '@/lib/server/services/support.service';

// Owner sends a support message to admin. (Owner reads the live thread directly
// from Firestore via onSnapshot — no fetch/poll needed for receiving.)
export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (req: NextRequest, ctx: { auth: AuthContext }) => {
        const ownerId = ctx.auth.uid; // owner threads are keyed by the owner uid
        let body: { text?: string };
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }
        if (!body.text) throw new AppError(400, 'Message text is required');

        const message = await supportService.sendMessage(ownerId, 'owner', ctx.auth.uid, body.text);
        return NextResponse.json({ success: true, message }, { status: 201 });
      },
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['owner'] }
  )
);

// Owner marks their thread read (clears their unread badge).
export const PATCH = withErrorHandler(
  withAuth(
    async (_req: NextRequest, ctx: { auth: AuthContext }) => {
      await supportService.markRead(ctx.auth.uid, 'owner');
      return NextResponse.json({ success: true });
    },
    { roles: ['owner'] }
  )
);
