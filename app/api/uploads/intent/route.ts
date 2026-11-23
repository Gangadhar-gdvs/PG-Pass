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
          tenantId?: string;
          photoType?: PhotoType;
          contentType?: string;
          sizeBytes?: number;
        };

        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }

        const { tenantId, photoType, contentType, sizeBytes } = body;

        if (!tenantId || typeof tenantId !== 'string') {
          throw new AppError(400, 'Missing tenantId');
        }
        if (!photoType || !Object.values(PHOTO_TYPE).includes(photoType)) {
          throw new AppError(400, 'Invalid photoType');
        }
        if (!contentType || typeof contentType !== 'string') {
          throw new AppError(400, 'Missing contentType');
        }
        if (!sizeBytes || typeof sizeBytes !== 'number' || sizeBytes <= 0) {
          throw new AppError(400, 'Invalid sizeBytes');
        }

        const ownerId = ctx.auth.ownerId || ctx.auth.uid;

        const result = await photosService.createUploadIntent({
          ownerId,
          tenantId,
          photoType,
          contentType,
          sizeBytes,
          uploadedBy: ctx.auth.uid,
        });

        return NextResponse.json(result);
      },
      { tier: 'standard' }
    ),
    { roles: ['owner', 'staff'] }
  )
);
