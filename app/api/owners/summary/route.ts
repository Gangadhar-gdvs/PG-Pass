import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { summaryService } from '@/lib/server/services/summary.service';

// Accurate, scale-safe dashboard totals (occupancy, potential, current-period
// collection) computed via Firestore aggregations — so the figures are correct
// even for PGs larger than the 100-row live window. Not feature-gated: every
// owner/staff needs their own headline numbers.
export const GET = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext }) => {
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const url = new URL(req.url);
      const propertyId = url.searchParams.get('propertyId') || undefined;
      const summary = await summaryService.getOwnerSummary(ownerId, propertyId);
      return NextResponse.json(summary);
    },
    { roles: ['owner', 'staff'] }
  )
);
