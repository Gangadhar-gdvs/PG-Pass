import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { photosService } from '@/lib/server/services/photos.service';
import { PhotoType, PHOTO_TYPE } from '@/lib/constants/status';

export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (req: NextRequest, ctx: { auth: AuthContext }) => {
        let body: {
          objectKey?: string;
          photoType?: PhotoType;
          rentRecordId?: string;
        };

        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }

        const { objectKey, photoType, rentRecordId } = body;

        if (!objectKey || typeof objectKey !== 'string') {
          throw new AppError(400, 'Missing objectKey');
        }
        if (!photoType || !Object.values(PHOTO_TYPE).includes(photoType)) {
          throw new AppError(400, 'Invalid photoType');
        }

        const ownerId = ctx.auth.ownerId || ctx.auth.uid;

        const result = await photosService.confirmUpload({
          ownerId,
          objectKey,
          photoType,
          rentRecordId,
          uploadedBy: ctx.auth.uid,
        });

        return NextResponse.json({
          success: true,
          photo: result,
        });
      },
      { tier: 'standard' }
    ),
    { roles: ['owner', 'staff'] }
  )
);
