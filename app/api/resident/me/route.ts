import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { residentsService } from '@/lib/server/services/residents.service';

/**
 * Resident home payload: profile + all linked tenancies (across PGs) enriched
 * with the PG name and current-period rent status. All data access lives in
 * `residentsService` — the route just authenticates and shapes the response.
 */
export const GET = withErrorHandler(
  withAuth(
    async (_req: NextRequest, ctx: { auth: AuthContext }) => {
      const uid = ctx.auth.uid;
      const [resident, tenancies] = await Promise.all([
        residentsService.getResident(uid),
        residentsService.myTenanciesEnriched(uid),
      ]);
      return NextResponse.json({ resident, tenancies });
    },
    { roles: ['resident'] }
  )
);
