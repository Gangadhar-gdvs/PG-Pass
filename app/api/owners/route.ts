import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { ownersService } from '@/lib/server/services/owners.service';
import { ownerProfileSchema } from '@/lib/validation';

export const GET = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext }) => {
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const profile = await ownersService.getProfile(ownerId);
      if (!profile) {
        throw new AppError(404, 'Owner profile not found');
      }
      return NextResponse.json(profile);
    },
    { roles: ['owner', 'staff', 'admin'] }
  )
);

export const PUT = withErrorHandler(
  withAuth(
    withRateLimit(
      async (req: NextRequest, ctx: { auth: AuthContext }) => {
        let body;
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }

        const validated = ownerProfileSchema.parse(body);
        const ownerId = ctx.auth.uid; // Only owner can update profile

        const updated = await ownersService.upsertProfile(ownerId, validated);
        return NextResponse.json(updated);
      },
      { tier: 'standard' }
    ),
    { roles: ['owner'] }
  )
);
