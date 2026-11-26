import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { supportService } from '@/lib/server/services/support.service';
import { ADMIN_PERMISSIONS } from '@/lib/constants/permissions';

// Admin lists all support threads (most recent first).
export const GET = withErrorHandler(
  withAuth(
    async () => {
      const threads = await supportService.listThreads();
      return NextResponse.json({ threads });
    },
    { roles: ['admin'], adminPermission: ADMIN_PERMISSIONS.SUPPORT_MANAGE }
  )
);

// Admin replies to an owner's thread (or marks it read).
export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (req: NextRequest, ctx: { auth: AuthContext }) => {
        let body: { ownerId?: string; text?: string; markRead?: boolean };
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }
        if (!body.ownerId) throw new AppError(400, 'ownerId is required');

        if (body.markRead) {
          await supportService.markRead(body.ownerId, 'admin');
          return NextResponse.json({ success: true });
        }

        if (!body.text) throw new AppError(400, 'Message text is required');
        const message = await supportService.sendMessage(body.ownerId, 'admin', ctx.auth.uid, body.text);
        return NextResponse.json({ success: true, message }, { status: 201 });
      },
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['admin'], adminPermission: ADMIN_PERMISSIONS.SUPPORT_MANAGE }
  )
);
