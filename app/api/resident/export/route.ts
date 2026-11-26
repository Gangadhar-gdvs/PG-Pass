import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { residentsService } from '@/lib/server/services/residents.service';
import { todayIST } from '@/lib/utils';

// DPDP data-access: a resident downloads ALL their own data as JSON. Strictly
// scoped to the caller (ctx.auth.uid). Rate-limited to deter scraping.
export const GET = withErrorHandler(
  withAuth(
    withRateLimit(
      async (_req, ctx: { auth: AuthContext }) => {
        const data = await residentsService.exportMyData(ctx.auth.uid);
        return new NextResponse(JSON.stringify(data, null, 2), {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Disposition': `attachment; filename="pgpass-my-data-${todayIST()}.json"`,
            'Cache-Control': 'private, no-store',
          },
        });
      },
      { tier: 'sensitive', key: 'uid', maxRequests: 5, windowSeconds: 300 }
    ),
    { roles: ['resident', 'tenant'] }
  )
);
