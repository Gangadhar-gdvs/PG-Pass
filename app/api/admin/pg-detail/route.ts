import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth } from '@/lib/server/api/withAuth';
import { getPgAdminDetail } from '@/lib/server/services/adminOverview.service';
import { ADMIN_PERMISSIONS } from '@/lib/constants/permissions';

// GET /api/admin/pg-detail?ownerId=... — full per-PG history for the admin panel.
export const GET = withErrorHandler(
  withAuth(
    async (req: NextRequest) => {
      const ownerId = req.nextUrl.searchParams.get('ownerId');
      if (!ownerId) throw new AppError(400, 'ownerId is required');
      const detail = await getPgAdminDetail(ownerId);
      return NextResponse.json(detail);
    },
    { roles: ['admin'], adminPermission: ADMIN_PERMISSIONS.PLATFORM_VIEW }
  )
);
