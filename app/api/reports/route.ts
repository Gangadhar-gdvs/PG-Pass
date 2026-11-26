import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { reportsService } from '@/lib/server/services/reports.service';

// Owner reports summary for a period (defaults to current month).
export const GET = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext }) => {
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const period = new URL(req.url).searchParams.get('period') || new Date().toISOString().slice(0, 7);
      const summary = await reportsService.summary(ownerId, period);
      return NextResponse.json({ period, summary });
    },
    { roles: ['owner', 'staff'] }
  )
);
