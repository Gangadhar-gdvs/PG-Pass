import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { rentService } from '@/lib/server/services/rent.service';
import { STAFF_PERMISSIONS } from '@/lib/constants/permissions';

// Confirm multiple pending/verify rent records at once (e.g. "mark a whole
// floor paid"). Returns which succeeded and which failed.
export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (req: NextRequest, ctx: { auth: AuthContext }) => {
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;
        let body: { recordIds?: string[] };
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }

        if (!Array.isArray(body.recordIds) || body.recordIds.length === 0) {
          throw new AppError(400, 'recordIds must be a non-empty array');
        }

        const result = await rentService.bulkConfirm(ownerId, body.recordIds, ctx.auth.uid);
        return NextResponse.json({ success: true, ...result });
      },
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['owner', 'staff'], permission: STAFF_PERMISSIONS.COLLECT_RENT }
  )
);
