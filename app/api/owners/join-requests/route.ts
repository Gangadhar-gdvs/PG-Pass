import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { discoveryService } from '@/lib/server/services/discovery.service';

// Owner lists pending resident join-requests for their PGs.
export const GET = withErrorHandler(
  withAuth(
    async (_req: NextRequest, ctx: { auth: AuthContext }) => {
      try {
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;
        const requests = await discoveryService.listForOwner(ownerId);
        return NextResponse.json({ requests });
      } catch (err) {
        console.warn('Failed to list join requests:', err);
        return NextResponse.json({ requests: [] });
      }
    },
    { roles: ['owner', 'staff'] }
  )
);

// Owner approves/declines a join request.
export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (req: NextRequest, ctx: { auth: AuthContext }) => {
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;
        let body: { requestId?: string; action?: 'approved' | 'declined' };
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }
        if (!body.requestId || (body.action !== 'approved' && body.action !== 'declined')) {
          throw new AppError(400, 'requestId and a valid action are required');
        }
        await discoveryService.review(body.requestId, ownerId, body.action, ctx.auth.uid);
        return NextResponse.json({ success: true });
      },
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['owner', 'staff'] }
  )
);
