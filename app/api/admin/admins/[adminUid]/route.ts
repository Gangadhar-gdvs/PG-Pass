import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { adminUsersService } from '@/lib/server/services/adminUsers.service';
import { ADMIN_PERMISSIONS } from '@/lib/constants/permissions';
import type { WithAuthOptions } from '@/lib/server/api/withAuth';
import { z } from 'zod';

const GATE: WithAuthOptions = { roles: ['admin'], adminPermission: ADMIN_PERMISSIONS.ADMINS_MANAGE };

const patchSchema = z.union([
  z.object({ permissions: z.array(z.string()) }),
  z.object({ status: z.enum(['active', 'suspended']) }),
]);

export const PATCH = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext; params: Promise<{ adminUid: string }> }) => {
      const { adminUid } = await ctx.params;
      if (!adminUid) throw new AppError(400, 'Admin id required');

      let body;
      try {
        body = await req.json();
      } catch {
        throw new AppError(400, 'Invalid JSON body');
      }
      const parsed = patchSchema.parse(body);

      if ('permissions' in parsed) {
        const admin = await adminUsersService.setPermissions(
          ctx.auth.uid,
          adminUid,
          parsed.permissions as never
        );
        return NextResponse.json({ admin });
      }

      const admin = await adminUsersService.setStatus(ctx.auth.uid, adminUid, parsed.status);
      return NextResponse.json({ admin });
    },
    GATE
  )
);
