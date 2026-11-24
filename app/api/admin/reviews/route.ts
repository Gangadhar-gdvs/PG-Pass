import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { reviewsService } from '@/lib/server/services/reviews.service';

// PATCH /api/admin/reviews — admin hides/unhides an abusive PG review.
export const PATCH = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext }) => {
      let body: { reviewId?: string; hidden?: boolean };
      try {
        body = await req.json();
      } catch {
        throw new AppError(400, 'Invalid JSON body');
      }
      if (!body.reviewId) throw new AppError(400, 'reviewId is required');
      const result = await reviewsService.setPgReviewHidden(
        body.reviewId,
        body.hidden !== false,
        ctx.auth.uid
      );
      return NextResponse.json(result);
    },
    { roles: ['admin'] }
  )
);
