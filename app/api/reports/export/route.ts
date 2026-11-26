import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { reportsService } from '@/lib/server/services/reports.service';
import { toCsv, csvResponseHeaders } from '@/lib/server/export/csv';
import { todayIST } from '@/lib/utils';

// CSV export: ?type=residents|rent|expenses (&period=YYYY-MM for rent/expenses).
// Injection-safe (toCsv neutralizes formula triggers). Rate-limited.
export const GET = withErrorHandler(
  withAuth(
    withRateLimit(
      async (req: NextRequest, ctx: { auth: AuthContext }) => {
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;
        const url = new URL(req.url);
        const type = url.searchParams.get('type') || 'residents';
        const period = url.searchParams.get('period') || undefined;
        const today = todayIST();

        let data: { headers: string[]; rows: unknown[][] };
        let name: string;
        if (type === 'rent') {
          data = await reportsService.rentExport(ownerId, period);
          name = `PGPass_Rent_${period || 'all'}_${today}.csv`;
        } else if (type === 'expenses') {
          data = await reportsService.expensesExport(ownerId, period);
          name = `PGPass_Expenses_${period || 'all'}_${today}.csv`;
        } else if (type === 'residents') {
          data = await reportsService.residentsExport(ownerId);
          name = `PGPass_Residents_${today}.csv`;
        } else {
          throw new AppError(400, 'Unknown export type');
        }

        const csv = toCsv(data.headers, data.rows);
        return new NextResponse(csv, { headers: csvResponseHeaders(name) });
      },
      { tier: 'sensitive', key: 'uid', maxRequests: 20, windowSeconds: 60 }
    ),
    { roles: ['owner'] }
  )
);
