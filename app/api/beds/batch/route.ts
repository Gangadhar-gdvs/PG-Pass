import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { bedsService, createBedsBatch } from '@/lib/server/services/beds.service';
import { createBedsBatchSchema } from '@/lib/validation';

export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (req: NextRequest, ctx: { auth: AuthContext }) => {
        let body;
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }

        const validated = createBedsBatchSchema.parse(body);
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;

        const fn = typeof bedsService?.createBedsBatch === 'function'
          ? bedsService.createBedsBatch.bind(bedsService)
          : createBedsBatch;

        const result = await fn(ownerId, validated.beds);
        return NextResponse.json(result, { status: 201 });
      },
      { tier: 'standard' }
    ),
    { roles: ['owner', 'staff'] }
  )
);
