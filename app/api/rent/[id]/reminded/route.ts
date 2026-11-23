import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { rentService } from '@/lib/server/services/rent.service';

// Stamps lastRemindedAt when owner taps Send & Next in WhatsApp queue modal
export const POST = withErrorHandler(
  withAuth(
    async (
      req: NextRequest,
      ctx: { auth: AuthContext; params: Promise<{ id: string }> }
    ) => {
      const { id: recordId } = await ctx.params;
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;

      await rentService.recordReminded(ownerId, recordId);
      return NextResponse.json({ success: true });
    },
    { roles: ['owner', 'staff'] }
  )
);
