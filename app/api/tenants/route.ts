import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { tenantsService } from '@/lib/server/services/tenants.service';
import { createTenantSchema } from '@/lib/validation';

export const GET = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext }) => {
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const url = new URL(req.url);
      const limit = parseInt(url.searchParams.get('limit') || '50', 10);
      const startAfter = url.searchParams.get('startAfter') || undefined;
      const includeDeleted = url.searchParams.get('includeDeleted') === 'true';

      const tenants = await tenantsService.listTenants(
        ownerId,
        includeDeleted,
        limit,
        startAfter
      );
      return NextResponse.json({ tenants });
    },
    { roles: ['owner', 'staff'] }
  )
);

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

        const validated = createTenantSchema.parse(body);
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;

        const result = await tenantsService.createTenant(ownerId, validated);
        return NextResponse.json(result, { status: 201 });
      },
      { tier: 'standard' }
    ),
    { roles: ['owner', 'staff'] }
  )
);
