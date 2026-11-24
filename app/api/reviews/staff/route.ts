import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { reviewsService } from '@/lib/server/services/reviews.service';

// GET /api/reviews/staff?staffUid=... — owner/admin list ratings for a staff member.
// The staff member must belong to the caller's PG (admin bypasses scoping).
export const GET = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext }) => {
      const staffUid = req.nextUrl.searchParams.get('staffUid');
      if (!staffUid) throw new AppError(400, 'staffUid is required');
      const scopeOwnerId =
        ctx.auth.role === 'admin' ? undefined : ctx.auth.ownerId || ctx.auth.uid;
      const ratings = await reviewsService.listStaffRatings(staffUid, scopeOwnerId);
      return NextResponse.json({ ratings });
    },
    { roles: ['owner', 'staff'] }
  )
);

// POST /api/reviews/staff — a resident of the PG rates an individual staff member.
export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (req: NextRequest, ctx: { auth: AuthContext }) => {
        let body: { staffUid?: string; rating?: number; note?: string };
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }
        if (!body.staffUid) throw new AppError(400, 'staffUid is required');
        if (typeof body.rating !== 'number' || !Number.isFinite(body.rating)) {
          throw new AppError(400, 'A valid rating is required');
        }

        const result = await reviewsService.submitStaffRating({
          reviewerUid: ctx.auth.uid,
          reviewerName: '',
          staffUid: body.staffUid,
          rating: body.rating,
          note: body.note,
        });
        return NextResponse.json({ success: true, rating: result }, { status: 201 });
      },
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['resident', 'tenant'] }
  )
);
