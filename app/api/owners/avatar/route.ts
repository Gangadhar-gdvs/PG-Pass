import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { ownerAvatarService } from '@/lib/server/services/ownerAvatar.service';

// Owner profile picture. Owner-only: the picture always belongs to the signed-in
// owner (session uid), never to a client-supplied id.

// GET /api/owners/avatar → { url: string | null } (short-lived presigned URL)
export const GET = withErrorHandler(
  withAuth(
    async (_req: NextRequest, ctx: { auth: AuthContext }) => {
      const url = await ownerAvatarService.getViewUrl(ctx.auth.uid);
      return NextResponse.json({ url });
    },
    { roles: ['owner'] }
  )
);

const avatarActionSchema = z.discriminatedUnion('step', [
  z.object({
    step: z.literal('intent'),
    contentType: z.string().min(1).max(40),
    sizeBytes: z.number().int().positive(),
  }),
  z.object({
    step: z.literal('confirm'),
    objectKey: z.string().min(1).max(300),
  }),
]);

// POST /api/owners/avatar
//   { step: 'intent', contentType, sizeBytes } → { uploadUrl, objectKey }  (presigned PUT)
//   { step: 'confirm', objectKey }             → { url }                   (verified + saved)
export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (req: NextRequest, ctx: { auth: AuthContext }) => {
        let body: unknown;
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }
        const data = avatarActionSchema.parse(body); // ZodError → 400 via withErrorHandler
        const uid = ctx.auth.uid;
        if (data.step === 'intent') {
          return NextResponse.json(
            await ownerAvatarService.createUploadIntent(uid, data.contentType, data.sizeBytes)
          );
        }
        return NextResponse.json(await ownerAvatarService.confirmUpload(uid, data.objectKey));
      },
      { tier: 'sensitive', key: 'uid', maxRequests: 20, windowSeconds: 300 }
    ),
    { roles: ['owner'] }
  )
);

// DELETE /api/owners/avatar → removes the picture (storage object + owner field)
export const DELETE = withErrorHandler(
  withAuth(
    withRateLimit(
      async (_req: NextRequest, ctx: { auth: AuthContext }) => {
        await ownerAvatarService.remove(ctx.auth.uid);
        return NextResponse.json({ success: true });
      },
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['owner'] }
  )
);
