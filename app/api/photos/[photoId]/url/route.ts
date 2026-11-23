import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { adminAuth } from '@/lib/server/firebase-admin';
import { verifyPortalSession } from '@/lib/server/security/portalAuth';
import { photosService } from '@/lib/server/services/photos.service';
import { SESSION_COOKIE_NAME } from '@/lib/constants/limits';

export const GET = withErrorHandler(
  async (
    req: NextRequest,
    ctx: { params: Promise<{ photoId: string }> }
  ) => {
    const { photoId } = await ctx.params;
    if (!photoId) {
      throw new AppError(400, 'Missing photoId');
    }

    let callerUid: string;
    let callerRole: string;
    let callerOwnerId: string | undefined;

    const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (sessionCookie) {
      let decoded;
      try {
        decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
      } catch {
        throw new AppError(401, 'Invalid session');
      }

      if (decoded.suspended) throw new AppError(403, 'Account suspended');
      callerUid = decoded.uid;
      callerRole = decoded.role || (decoded.admin ? 'admin' : 'owner');
      callerOwnerId = decoded.admin ? undefined : (callerRole === 'owner' ? decoded.uid : decoded.ownerId);
    } else {
      const url = new URL(req.url);
      const token = url.searchParams.get('token');
      const pin = url.searchParams.get('pin');

      if (!token || !pin) {
        throw new AppError(401, 'Authentication or portal verification required');
      }

      const session = await verifyPortalSession(token, pin);
      callerUid = session.tenantId;
      callerRole = 'tenant';
      callerOwnerId = session.ownerId;
    }

    const result = await photosService.getPhotoPresignedUrl({
      photoId,
      callerUid,
      callerRole,
      callerOwnerId,
    });

    const response = NextResponse.json(result);
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }
);
