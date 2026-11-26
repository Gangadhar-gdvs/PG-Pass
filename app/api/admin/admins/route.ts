import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { adminUsersService } from '@/lib/server/services/adminUsers.service';
import { ADMIN_PERMISSIONS } from '@/lib/constants/permissions';
import type { WithAuthOptions } from '@/lib/server/api/withAuth';
import { z } from 'zod';

// Managing admins is SUPER-ADMIN-ONLY (ADMINS_MANAGE is held only by supers).
const GATE: WithAuthOptions = { roles: ['admin'], adminPermission: ADMIN_PERMISSIONS.ADMINS_MANAGE };

export const GET = withErrorHandler(
  withAuth(async () => {
    const admins = await adminUsersService.listAdmins();
    return NextResponse.json({ admins });
  }, GATE)
);

const createSchema = z.object({
  email: z.string().email('A valid email is required'),
  name: z.string().max(80).optional(),
  permissions: z.array(z.string()).optional(),
});

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
        const parsed = createSchema.parse(body);
        const admin = await adminUsersService.createAdmin(ctx.auth.uid, {
          email: parsed.email,
          name: parsed.name,
          permissions: parsed.permissions as never,
        });
        return NextResponse.json({ admin }, { status: 201 });
      },
      { tier: 'sensitive', key: 'uid', maxRequests: 20, windowSeconds: 60 }
    ),
    GATE
  )
);
