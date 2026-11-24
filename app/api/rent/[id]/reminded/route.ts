import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { rentService } from '@/lib/server/services/rent.service';

// Stamps lastRemindedAt and auto-sends the reminder via SMS/email if configured
// (otherwise the client uses the free "open WhatsApp" fallback). Returns which
// channels fired so the UI can inform the owner.
export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (
        req: NextRequest,
        ctx: { auth: AuthContext; params: Promise<{ id: string }> }
      ) => {
        const { id: recordId } = await ctx.params;
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;

        const channels = await rentService.recordReminded(ownerId, recordId);
        return NextResponse.json({ success: true, channels });
      },
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['owner', 'staff'] }
  )
);
