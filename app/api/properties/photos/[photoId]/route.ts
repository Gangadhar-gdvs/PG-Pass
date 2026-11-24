import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { photosService } from '@/lib/server/services/photos.service';
import { STAFF_PERMISSIONS, PG_FEATURES } from '@/lib/constants/permissions';

// DELETE /api/properties/photos/[photoId] — owner removes a gallery photo.
export const DELETE = withErrorHandler(
  withAuth(
    async (
      _req: NextRequest,
      ctx: { auth: AuthContext; params: Promise<{ photoId: string }> }
    ) => {
      const { photoId } = await ctx.params;
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const result = await photosService.deletePropertyPhoto(photoId, ownerId);
      return NextResponse.json(result);
    },
    { roles: ['owner', 'staff'], permission: STAFF_PERMISSIONS.MANAGE_PHOTOS, feature: PG_FEATURES.PHOTO_GALLERY }
  )
);
