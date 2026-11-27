import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext, AuthedContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { withValidation } from '@/lib/server/api/withValidation';
import { assetsService } from '@/lib/server/services/assets.service';
import { createAssetSchema, type CreateAssetData } from '@/lib/validation';
import { STAFF_PERMISSIONS } from '@/lib/constants/permissions';

// Room inventory. Any owner/staff of the PG can VIEW (check-in/out inspections);
// changes need the `manage_beds` ("beds & room inventory") staff permission.
export const GET = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext }) => {
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const propertyId = new URL(req.url).searchParams.get('propertyId') || undefined;
      const { assets, summary } = await assetsService.list(ownerId, propertyId);
      return NextResponse.json({ assets, summary });
    },
    { roles: ['owner', 'staff'], permission: STAFF_PERMISSIONS.MANAGE_BEDS }
  )
);

export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      withValidation<CreateAssetData, AuthedContext>(createAssetSchema)(async (_req, ctx) => {
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;
        const asset = await assetsService.create(ownerId, { uid: ctx.auth.uid, role: ctx.auth.role }, ctx.data);
        return NextResponse.json({ success: true, asset }, { status: 201 });
      }),
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['owner', 'staff'], permission: STAFF_PERMISSIONS.MANAGE_BEDS }
  )
);
