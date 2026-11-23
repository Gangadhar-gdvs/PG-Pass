import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { bedsService } from '@/lib/server/services/beds.service';
import { updateBedSchema } from '@/lib/validation';

export const GET = withErrorHandler(
  withAuth(
    async (
      req: NextRequest,
      ctx: { auth: AuthContext; params: Promise<{ id: string }> }
    ) => {
      const { id } = await ctx.params;
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const bed = await bedsService.getBed(id, ownerId);
      return NextResponse.json(bed);
    },
    { roles: ['owner', 'staff'] }
  )
);

export const PATCH = withErrorHandler(
  withAuth(
    withRateLimit(
      async (
        req: NextRequest,
        ctx: { auth: AuthContext; params: Promise<{ id: string }> }
      ) => {
        const { id } = await ctx.params;
        let body;
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }

        const validated = updateBedSchema.parse(body);
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;

        const updated = await bedsService.updateBed(id, ownerId, validated);
        return NextResponse.json(updated);
      },
      { tier: 'standard' }
    ),
    { roles: ['owner', 'staff'] }
  )
);

export const DELETE = withErrorHandler(
  withAuth(
    withRateLimit(
      async (
        req: NextRequest,
        ctx: { auth: AuthContext; params: Promise<{ id: string }> }
      ) => {
        const { id } = await ctx.params;
        const ownerId = ctx.auth.uid; // Only owner can delete beds
        await bedsService.deleteBed(id, ownerId);
        return NextResponse.json({ success: true });
      },
      { tier: 'standard' }
    ),
    { roles: ['owner'] }
  )
);
