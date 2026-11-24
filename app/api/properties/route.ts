import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { propertiesService } from '@/lib/server/services/properties.service';

// List the owner's properties (the primary is materialized lazily).
export const GET = withErrorHandler(
  withAuth(
    async (_req: NextRequest, ctx: { auth: AuthContext }) => {
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const properties = await propertiesService.listProperties(ownerId);
      return NextResponse.json({ properties });
    },
    { roles: ['owner', 'staff'] }
  )
);

// Create an additional property (owner only).
export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (req: NextRequest, ctx: { auth: AuthContext }) => {
        const ownerId = ctx.auth.uid;
        let body: {
          pgName?: string;
          pgAddress?: string;
          pgCategory?: 'gents' | 'ladies' | 'coliving';
          monthlyRent?: number;
          rentDueDay?: number;
        };
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }
        if (!body.pgName) throw new AppError(400, 'pgName is required');

        const property = await propertiesService.createProperty(ownerId, {
          pgName: body.pgName,
          pgAddress: body.pgAddress,
          pgCategory: body.pgCategory,
          monthlyRent: body.monthlyRent,
          rentDueDay: body.rentDueDay,
        });
        return NextResponse.json({ success: true, property }, { status: 201 });
      },
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['owner'] }
  )
);
