import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { bedsService, createBedsBatch } from '@/lib/server/services/beds.service';
import { createBedsBatchSchema } from '@/lib/validation';
import { STAFF_PERMISSIONS } from '@/lib/constants/permissions';

export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (req: NextRequest, ctx: { auth: AuthContext }) => {
        let body;
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }

        const validated = createBedsBatchSchema.parse(body);
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;
        // Optional target property (defaults to primary = ownerId inside the
        // service). Validated loosely: must belong to this owner's namespace.
        const propertyId =
          typeof body?.propertyId === 'string' ? body.propertyId : undefined;

        const fn = typeof bedsService?.createBedsBatch === 'function'
          ? bedsService.createBedsBatch.bind(bedsService)
          : createBedsBatch;

        const result = await fn(ownerId, validated.beds, propertyId);
        return NextResponse.json(result, { status: 201 });
      },
      { tier: 'standard' }
    ),
    { roles: ['owner', 'staff'], permission: STAFF_PERMISSIONS.MANAGE_BEDS }
  )
);
