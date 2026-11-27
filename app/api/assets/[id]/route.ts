import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext, AuthedContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { withValidation } from '@/lib/server/api/withValidation';
import { assetsService } from '@/lib/server/services/assets.service';
import { updateAssetSchema, type UpdateAssetData } from '@/lib/validation';
import { STAFF_PERMISSIONS } from '@/lib/constants/permissions';

type IdCtx = { auth: AuthContext; params: Promise<{ id: string }> };

export const GET = withErrorHandler(
  withAuth(
    async (_req: NextRequest, ctx: IdCtx) => {
      const { id } = await ctx.params;
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const asset = await assetsService.get(ownerId, id);
      return NextResponse.json({ asset });
    },
    { roles: ['owner', 'staff'], permission: STAFF_PERMISSIONS.MANAGE_BEDS }
  )
);

// Edit condition / quantity / details — appends to the item's history.
export const PATCH = withErrorHandler(
  withAuth(
    withRateLimit(
      withValidation<UpdateAssetData, AuthedContext & { params: Promise<{ id: string }> }>(updateAssetSchema)(
        async (_req, ctx) => {
          const { id } = await ctx.params;
          const ownerId = ctx.auth.ownerId || ctx.auth.uid;
          const asset = await assetsService.update(ownerId, { uid: ctx.auth.uid, role: ctx.auth.role }, id, ctx.data);
          return NextResponse.json({ success: true, asset });
        }
      ),
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['owner', 'staff'], permission: STAFF_PERMISSIONS.MANAGE_BEDS }
  )
);

// Soft delete (record + history kept).
export const DELETE = withErrorHandler(
  withAuth(
    withRateLimit(
      async (_req: NextRequest, ctx: IdCtx) => {
        const { id } = await ctx.params;
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;
        await assetsService.softDelete(ownerId, { uid: ctx.auth.uid, role: ctx.auth.role }, id);
        return NextResponse.json({ success: true });
      },
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['owner', 'staff'], permission: STAFF_PERMISSIONS.MANAGE_BEDS }
  )
);
