import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { photosService } from '@/lib/server/services/photos.service';

// Owner/staff lists a tenant's photo metadata (move-in, ID proof, payment
// proofs). Bytes are fetched per-photo via GET /api/photos/[photoId]/url.
export const GET = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext }) => {
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const tenantId = new URL(req.url).searchParams.get('tenantId');
      if (!tenantId) throw new AppError(400, 'tenantId is required');

      const photos = await photosService.listTenantPhotos(ownerId, tenantId);
      return NextResponse.json({ photos });
    },
    { roles: ['owner', 'staff'] }
  )
);
