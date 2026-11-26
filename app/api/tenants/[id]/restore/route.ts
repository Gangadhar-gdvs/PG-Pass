import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { tenantsService } from '@/lib/server/services/tenants.service';

// Undo soft-delete within 7 days
export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (
        req: NextRequest,
        ctx: { auth: AuthContext; params: Promise<{ id: string }> }
      ) => {
        const { id } = await ctx.params;
        const ownerId = ctx.auth.uid; // Only owner can restore

        let body: { newBedId?: string } = {};
        try {
          body = await req.json();
        } catch {
          // Optional body
        }

        const restored = await tenantsService.restoreTenant(
          id,
          ownerId,
          body.newBedId
        );
        return NextResponse.json(restored);
      },
      { tier: 'standard' }
    ),
    { roles: ['owner'] }
  )
);
