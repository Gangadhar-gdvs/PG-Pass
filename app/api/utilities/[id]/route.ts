import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { utilitiesService } from '@/lib/server/services/utilities.service';

// Bill detail (allocation table + history).
export const GET = withErrorHandler(
  withAuth(
    async (_req: NextRequest, ctx: { auth: AuthContext; params: Promise<{ id: string }> }) => {
      const { id } = await ctx.params;
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const bill = await utilitiesService.get(ownerId, id);
      return NextResponse.json({ bill });
    },
    { roles: ['owner'] }
  )
);
