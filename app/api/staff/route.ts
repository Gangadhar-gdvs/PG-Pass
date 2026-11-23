import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { staffService } from '@/lib/server/services/staff.service';
import { z } from 'zod';

const inviteStaffSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian phone number'),
});

// GET: Lists staff under owner (strictly owner-only)
export const GET = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext }) => {
      const ownerId = ctx.auth.uid;
      const staffList = await staffService.listStaff(ownerId);
      return NextResponse.json({ staff: staffList });
    },
    { roles: ['owner', 'admin'] }
  )
);

// POST: Invites/provisions a warden account
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

        const validated = inviteStaffSchema.parse(body);
        const ownerId = ctx.auth.uid;

        const created = await staffService.inviteStaff(ownerId, validated, ctx.auth.uid);
        return NextResponse.json(created, { status: 201 });
      },
      { tier: 'standard' }
    ),
    { roles: ['owner'] }
  )
);
