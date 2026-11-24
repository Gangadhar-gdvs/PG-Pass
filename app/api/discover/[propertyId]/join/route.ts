import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { discoveryService } from '@/lib/server/services/discovery.service';
import { residentsService } from '@/lib/server/services/residents.service';

// A logged-in resident requests to join a listed PG.
export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (
        req: NextRequest,
        ctx: { auth: AuthContext; params: Promise<{ propertyId: string }> }
      ) => {
        const { propertyId } = await ctx.params;
        const resident = await residentsService.getResident(ctx.auth.uid);
        if (!resident) throw new AppError(404, 'Resident profile not found');

        let body: { message?: string } = {};
        try {
          body = await req.json();
        } catch {
          /* message optional */
        }

        const joinReq = await discoveryService.requestJoin({
          propertyId,
          residentId: resident.id,
          residentName: resident.name,
          residentPhone: resident.phone,
          message: body.message,
        });
        return NextResponse.json({ success: true, request: joinReq }, { status: 201 });
      },
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['resident'] }
  )
);
