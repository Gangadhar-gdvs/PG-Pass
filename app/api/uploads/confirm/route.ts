import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { adminAuth } from '@/lib/server/firebase-admin';
import { verifyPortalSession } from '@/lib/server/security/portalAuth';
import { photosService } from '@/lib/server/services/photos.service';
import { PhotoType, PHOTO_TYPE } from '@/lib/constants/status';
import { SESSION_COOKIE_NAME } from '@/lib/constants/limits';

export const POST = withErrorHandler(
  withRateLimit(
    async (req: NextRequest) => {
      let body: {
        objectKey?: string;
        photoType?: PhotoType;
        rentRecordId?: string;
        token?: string;
        pin?: string;
      };

      try {
        body = await req.json();
      } catch {
        throw new AppError(400, 'Invalid JSON body');
      }

      const { objectKey, photoType, rentRecordId, token, pin } = body;

      if (!objectKey || typeof objectKey !== 'string') {
        throw new AppError(400, 'Missing objectKey');
      }
      if (!photoType || !Object.values(PHOTO_TYPE).includes(photoType)) {
        throw new AppError(400, 'Invalid photoType');
      }

      let ownerId: string;
      let uploadedBy: string;

      const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;

      if (sessionCookie) {
        let decoded;
        try {
          decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
        } catch {
          throw new AppError(401, 'Invalid session');
        }

        if (decoded.suspended) throw new AppError(403, 'Account suspended');
        const role = decoded.role || (decoded.admin ? 'admin' : 'owner');
        if (!['owner', 'staff', 'admin'].includes(role)) {
          throw new AppError(403, 'Unauthorized role');
        }

        ownerId = decoded.admin
          ? decoded.ownerId || decoded.uid
          : role === 'owner'
          ? decoded.uid
          : decoded.ownerId || '';
        uploadedBy = decoded.uid;
      } else if (token && pin) {
        const session = await verifyPortalSession(token, pin);
        ownerId = session.ownerId;
        uploadedBy = `tenant:${session.tenantId}`;
      } else {
        throw new AppError(401, 'Authentication or portal verification required');
      }

      const result = await photosService.confirmUpload({
        ownerId,
        objectKey,
        photoType,
        rentRecordId,
        uploadedBy,
      });

      return NextResponse.json({
        success: true,
        photo: result,
      });
    },
    { tier: 'standard' }
  )
);
