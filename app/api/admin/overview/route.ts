import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth } from '@/lib/server/api/withAuth';
import { getPlatformOverview } from '@/lib/server/services/adminOverview.service';

export const GET = withErrorHandler(
  withAuth(
    async () => {
      const overview = await getPlatformOverview();
      return NextResponse.json(overview);
    },
    { roles: ['admin'] }
  )
);
