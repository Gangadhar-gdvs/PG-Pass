import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { noticesService } from '@/lib/server/services/notices.service';

// Owner marks a notice read (PATCH) or soft-deletes it (DELETE).
export const PATCH = withErrorHandler(
  withAuth(
    async (_req: NextRequest, ctx: { auth: AuthContext; params: Promise<{ id: string }> }) => {
      const { id } = await ctx.params;
      if (!id) throw new AppError(400, 'Notice id required');
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      await noticesService.markRead(id, ownerId, ctx.auth.uid);
      return NextResponse.json({ success: true });
    },
    { roles: ['owner', 'staff'] }
  )
);

export const DELETE = withErrorHandler(
  withAuth(
    async (_req: NextRequest, ctx: { auth: AuthContext; params: Promise<{ id: string }> }) => {
      const { id } = await ctx.params;
      if (!id) throw new AppError(400, 'Notice id required');
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      await noticesService.softDelete(id, ownerId);
      return NextResponse.json({ success: true });
    },
    { roles: ['owner'] }
  )
);
