import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { tenantsService } from '@/lib/server/services/tenants.service';

export const GET = withErrorHandler(
  withAuth(
    async (
      req: NextRequest,
      ctx: { auth: AuthContext; params: Promise<{ id: string }> }
    ) => {
      const { id } = await ctx.params;
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const tenant = await tenantsService.getTenant(id, ownerId);
      return NextResponse.json(tenant);
    },
    { roles: ['owner', 'staff'] }
  )
);

// Soft-delete tenant with 7-day undo window
export const DELETE = withErrorHandler(
  withAuth(
    withRateLimit(
      async (
        req: NextRequest,
        ctx: { auth: AuthContext; params: Promise<{ id: string }> }
      ) => {
        const { id } = await ctx.params;
        const ownerId = ctx.auth.uid; // Only owner can delete tenants
        const result = await tenantsService.softDeleteTenant(
          id,
          ownerId,
          ctx.auth.uid
        );
        return NextResponse.json(result);
      },
      { tier: 'standard' }
    ),
    { roles: ['owner'] }
  )
);
