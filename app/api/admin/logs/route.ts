import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth } from '@/lib/server/api/withAuth';
import { fetchSystemLogs } from '@/lib/server/services/systemLogs.service';

export const GET = withErrorHandler(
  withAuth(
    async (req: NextRequest) => {
      const { searchParams } = new URL(req.url);
      const level = searchParams.get('level') || 'all';
      const limitParam = parseInt(searchParams.get('limit') || '100', 10);
      const limit = isNaN(limitParam) ? 100 : Math.min(limitParam, 200);

      const logs = await fetchSystemLogs(limit, level);
      return NextResponse.json({ logs });
    },
    { roles: ['admin'] }
  )
);
