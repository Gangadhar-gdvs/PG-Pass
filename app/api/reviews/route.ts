import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { reviewsService } from '@/lib/server/services/reviews.service';

// GET /api/reviews?propertyId=... — PUBLIC list of a PG's visible reviews.
export const GET = withErrorHandler(async (req: NextRequest) => {
  const propertyId = req.nextUrl.searchParams.get('propertyId');
  if (!propertyId) throw new AppError(400, 'propertyId is required');
  const reviews = await reviewsService.listPgReviews(propertyId);
  return NextResponse.json({ reviews });
});

// POST /api/reviews — submit/update a PG review. Only verified tenants, guests,
// or staff of that PG may post (enforced server-side via eligibility check).
export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (req: NextRequest, ctx: { auth: AuthContext }) => {
        let body: { ownerId?: string; propertyId?: string; rating?: number; text?: string };
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }
        if (!body.ownerId || !body.propertyId) {
          throw new AppError(400, 'ownerId and propertyId are required');
        }
        if (typeof body.rating !== 'number' || !Number.isFinite(body.rating)) {
          throw new AppError(400, 'A valid rating is required');
        }

        const role = ctx.auth.role === 'staff' ? 'staff' : ctx.auth.role === 'tenant' ? 'tenant' : 'resident';
        const result = await reviewsService.submitPgReview({
          reviewerUid: ctx.auth.uid,
          reviewerRole: role,
          reviewerName: '',
          ownerId: body.ownerId,
          propertyId: body.propertyId,
          rating: body.rating,
          text: body.text,
        });
        return NextResponse.json({ success: true, review: result }, { status: 201 });
      },
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['resident', 'tenant', 'staff'] }
  )
);
