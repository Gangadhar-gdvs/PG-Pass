import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { rentService } from '@/lib/server/services/rent.service';
import { createRentRecordSchema } from '@/lib/validation';
import { RentStatus } from '@/lib/constants/status';
import { STAFF_PERMISSIONS } from '@/lib/constants/permissions';

export const GET = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext }) => {
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const url = new URL(req.url);
      const period = url.searchParams.get('period') || undefined;
      const status = (url.searchParams.get('status') as RentStatus) || undefined;
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const startAfter = url.searchParams.get('startAfter') || undefined;

      const records = await rentService.listRentRecords(
        ownerId,
        period,
        status,
        limit,
        startAfter
      );
      return NextResponse.json({ records });
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

        const validated = createRentRecordSchema.parse(body);
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;

        const record = await rentService.createRentRecord(ownerId, validated);
        return NextResponse.json(record, { status: 201 });
      },
      { tier: 'standard' }
    ),
    { roles: ['owner', 'staff'], permission: STAFF_PERMISSIONS.COLLECT_RENT }
  )
);
