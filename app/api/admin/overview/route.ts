import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth } from '@/lib/server/api/withAuth';
import { getPlatformOverview } from '@/lib/server/services/adminOverview.service';

// Paginated: ?cursor=<lastOwnerId>&pageSize=50. Platform totals come from the
// precomputed metrics doc; the per-PG list is a bounded page.
export const GET = withErrorHandler(
  withAuth(
    async (req: NextRequest) => {
      const url = new URL(req.url);
      const cursor = url.searchParams.get('cursor') || undefined;
      const pageSize = parseInt(url.searchParams.get('pageSize') || '50', 10);
      const overview = await getPlatformOverview(pageSize, cursor);
      return NextResponse.json(overview);
    },
    { roles: ['admin'] }
  )
);
