import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { adminPgService } from '@/lib/server/services/adminPg.service';
import { ADMIN_PERMISSIONS } from '@/lib/constants/permissions';

// GET /api/admin/features?ownerId=... — current per-PG feature flags (admin).
export const GET = withErrorHandler(
  withAuth(
    async (req: NextRequest) => {
      const ownerId = req.nextUrl.searchParams.get('ownerId');
      if (!ownerId) throw new AppError(400, 'ownerId is required');
      const features = await adminPgService.getFeatures(ownerId);
      return NextResponse.json({ ownerId, features });
    },
    { roles: ['admin'], adminPermission: ADMIN_PERMISSIONS.PG_MANAGE }
  )
);

// PATCH /api/admin/features — admin enables/disables a feature for one PG.
// Body: { ownerId, feature, enabled }
export const PATCH = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext }) => {
      let body: { ownerId?: string; feature?: string; enabled?: boolean };
      try {
        body = await req.json();
      } catch {
        throw new AppError(400, 'Invalid JSON body');
      }
      const { ownerId, feature } = body;
      if (!ownerId || !feature) throw new AppError(400, 'ownerId and feature are required');

      const enabled = body.enabled !== false;
      await adminPgService.setFeature({ ownerId, feature, enabled, actorUid: ctx.auth.uid });

      return NextResponse.json({ success: true, ownerId, feature, enabled });
    },
    { roles: ['admin'], adminPermission: ADMIN_PERMISSIONS.PG_MANAGE }
  )
);
