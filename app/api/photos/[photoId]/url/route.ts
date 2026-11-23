import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { photosService } from '@/lib/server/services/photos.service';

export const GET = withErrorHandler(
  withAuth(
    async (
      req: NextRequest,
      ctx: { auth: AuthContext; params: Promise<{ photoId: string }> }
    ) => {
      const { photoId } = await ctx.params;
      if (!photoId) {
        throw new AppError(400, 'Missing photoId');
      }

      const result = await photosService.getPhotoPresignedUrl({
        photoId,
        callerUid: ctx.auth.uid,
        callerRole: ctx.auth.role,
        callerOwnerId: ctx.auth.ownerId,
      });

      const response = NextResponse.json(result);
      response.headers.set('Cache-Control', 'private, no-store');
      return response;
    },
    { roles: ['owner', 'staff', 'admin'] }
  )
);
