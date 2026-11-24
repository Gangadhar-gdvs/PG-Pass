import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { analyticsService } from '@/lib/server/services/analytics.service';

// Per-owner business analytics: occupancy, collection %, 6-month trend, and
// defaulter aging buckets — computed server-side from the owner's own data.
export const GET = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext }) => {
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const todayIso = new Date().toISOString().slice(0, 10);
      const analytics = await analyticsService.getOwnerAnalytics(ownerId, todayIso);
      return NextResponse.json(analytics);
    },
    { roles: ['owner', 'staff'] }
  )
);
