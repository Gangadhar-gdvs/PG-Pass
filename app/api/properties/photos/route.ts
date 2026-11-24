import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { photosService } from '@/lib/server/services/photos.service';
import { STAFF_PERMISSIONS, PG_FEATURES } from '@/lib/constants/permissions';

// GET /api/properties/photos?propertyId=... — owner lists their gallery photos.
// (Public viewers use GET /api/discover/[propertyId] which embeds photos.)
export const GET = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext }) => {
      const propertyId = req.nextUrl.searchParams.get('propertyId') || ctx.auth.ownerId || ctx.auth.uid;
      const photos = await photosService.listPropertyPhotos(propertyId);
      return NextResponse.json({ photos });
    },
    { roles: ['owner', 'staff'], feature: PG_FEATURES.PHOTO_GALLERY }
  )
);

// POST /api/properties/photos — step 1: mint a presigned upload URL.
export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (req: NextRequest, ctx: { auth: AuthContext }) => {
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;
        let body: { propertyId?: string; contentType?: string; sizeBytes?: number };
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }
        if (!body.contentType) throw new AppError(400, 'Missing contentType');
        if (!body.sizeBytes || body.sizeBytes <= 0) throw new AppError(400, 'Invalid sizeBytes');

        const result = await photosService.createPropertyUploadIntent({
          ownerId,
          propertyId: body.propertyId || ownerId,
          contentType: body.contentType,
          sizeBytes: body.sizeBytes,
        });
        return NextResponse.json(result);
      },
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['owner', 'staff'], permission: STAFF_PERMISSIONS.MANAGE_PHOTOS, feature: PG_FEATURES.PHOTO_GALLERY }
  )
);

// PUT /api/properties/photos — step 2: confirm + publish the uploaded photo.
export const PUT = withErrorHandler(
  withAuth(
    withRateLimit(
      async (req: NextRequest, ctx: { auth: AuthContext }) => {
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;
        let body: {
          propertyId?: string;
          objectKey?: string;
          category?: string;
          caption?: string;
          sharingType?: string;
        };
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }
        if (!body.objectKey) throw new AppError(400, 'Missing objectKey');

        const photo = await photosService.confirmPropertyUpload({
          ownerId,
          propertyId: body.propertyId || ownerId,
          objectKey: body.objectKey,
          category: body.category || 'other',
          caption: body.caption,
          sharingType: body.sharingType,
          uploadedBy: ctx.auth.uid,
        });
        return NextResponse.json({ success: true, photo }, { status: 201 });
      },
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['owner', 'staff'], permission: STAFF_PERMISSIONS.MANAGE_PHOTOS, feature: PG_FEATURES.PHOTO_GALLERY }
  )
);
