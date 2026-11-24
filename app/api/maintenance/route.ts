import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { verifyPortalSession } from '@/lib/server/security/portalAuth';
import { maintenanceService } from '@/lib/server/services/maintenance.service';
import { STAFF_PERMISSIONS, PG_FEATURES } from '@/lib/constants/permissions';

// Tenant raises a maintenance ticket from the portal (token + PIN auth).
export const POST = withErrorHandler(
  withRateLimit(
    async (req: NextRequest) => {
      let body: {
        token?: string;
        pin?: string;
        category?: string;
        description?: string;
        photoId?: string;
      };
      try {
        body = await req.json();
      } catch {
        throw new AppError(400, 'Invalid request body');
      }

      if (!body.token || !body.pin) {
        throw new AppError(401, 'Portal verification required');
      }
      if (!body.description || body.description.trim().length < 3) {
        throw new AppError(400, 'Please describe the issue');
      }

      const session = await verifyPortalSession(body.token, body.pin);

      const ticket = await maintenanceService.createTicket({
        ownerId: session.ownerId,
        tenantId: session.tenantId,
        category: body.category || 'other',
        description: body.description,
        photoId: body.photoId,
      });

      return NextResponse.json({ success: true, ticket }, { status: 201 });
    },
    { tier: 'sensitive', key: 'ip', maxRequests: 10, windowSeconds: 60 }
  )
);

// Owner/staff lists maintenance tickets for their PG.
export const GET = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext }) => {
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const url = new URL(req.url);
      const status = url.searchParams.get('status') as any;
      const tickets = await maintenanceService.listForOwner(ownerId, status || undefined);
      return NextResponse.json({ tickets });
    },
    { roles: ['owner', 'staff'], permission: STAFF_PERMISSIONS.MANAGE_MAINTENANCE, feature: PG_FEATURES.MAINTENANCE }
  )
);
