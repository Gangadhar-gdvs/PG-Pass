import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { guestsService } from '@/lib/server/services/guests.service';

// List guest stays (active + past).
export const GET = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext }) => {
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const status = new URL(req.url).searchParams.get('status') as 'active' | 'completed' | null;
      const guests = await guestsService.list(ownerId, status || undefined);
      return NextResponse.json({ guests });
    },
    { roles: ['owner', 'staff'] }
  )
);

// Check in a short-stay guest.
export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (req: NextRequest, ctx: { auth: AuthContext }) => {
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;
        let body: any;
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }
        if (!body.bedId || !body.name || !body.checkInDate || !body.checkOutDate) {
          throw new AppError(400, 'bedId, name, checkInDate and checkOutDate are required');
        }

        const stay = await guestsService.checkIn(ownerId, ctx.auth.uid, {
          bedId: body.bedId,
          name: body.name,
          phone: body.phone,
          checkInDate: body.checkInDate,
          checkOutDate: body.checkOutDate,
          billingMode: body.billingMode === 'flat' ? 'flat' : 'per_night',
          nightlyRatePaise:
            body.nightlyRatePaise ??
            (typeof body.nightlyRateRupees === 'number' ? Math.round(body.nightlyRateRupees * 100) : undefined),
          flatTotalPaise:
            body.flatTotalPaise ??
            (typeof body.flatTotalRupees === 'number' ? Math.round(body.flatTotalRupees * 100) : undefined),
          amountPaidPaise:
            body.amountPaidPaise ??
            (typeof body.amountPaidRupees === 'number' ? Math.round(body.amountPaidRupees * 100) : undefined),
          idProofType: body.idProofType,
          notes: body.notes,
        });

        return NextResponse.json({ success: true, guest: stay }, { status: 201 });
      },
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['owner', 'staff'] }
  )
);
