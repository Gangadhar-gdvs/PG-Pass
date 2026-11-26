import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { visitorsService } from '@/lib/server/services/visitors.service';

// Owner/staff check a visitor out.
export const POST = withErrorHandler(
  withAuth(
    async (_req: NextRequest, ctx: { auth: AuthContext; params: Promise<{ id: string }> }) => {
      const { id } = await ctx.params;
      if (!id) throw new AppError(400, 'Visitor id required');
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const visitor = await visitorsService.checkOut(id, ownerId);
      return NextResponse.json({ visitor });
    },
    { roles: ['owner', 'staff'] }
  )
);
