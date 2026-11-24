import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { bedsService } from '@/lib/server/services/beds.service';
import { createBedSchema } from '@/lib/validation';
import { STAFF_PERMISSIONS } from '@/lib/constants/permissions';

export const GET = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext }) => {
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const url = new URL(req.url);
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const startAfter = url.searchParams.get('startAfter') || undefined;

      const beds = await bedsService.listBeds(ownerId, limit, startAfter);
      return NextResponse.json({ beds });
    },
    { roles: ['owner', 'staff'] }
  )
);

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

        const validated = createBedSchema.parse(body);
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;

        const newBed = await bedsService.createBed(ownerId, validated);
        return NextResponse.json(newBed, { status: 201 });
      },
      { tier: 'standard' }
    ),
    { roles: ['owner', 'staff'], permission: STAFF_PERMISSIONS.MANAGE_BEDS }
  )
);
