import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { visitorsService } from '@/lib/server/services/visitors.service';
import { z } from 'zod';

// Owner/staff list recent visitors.
export const GET = withErrorHandler(
  withAuth(
    async (_req: NextRequest, ctx: { auth: AuthContext }) => {
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const visitors = await visitorsService.list(ownerId);
      return NextResponse.json({ visitors });
    },
    { roles: ['owner', 'staff'] }
  )
);

const checkInSchema = z.object({
  name: z.string().min(2).max(80),
  purpose: z.string().max(120).optional(),
  visitingResident: z.string().max(80).optional(),
  roomNumber: z.string().max(20).optional(),
  phone: z.string().max(20).optional(),
});

// Owner/staff log a visitor check-in.
export const POST = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext }) => {
      let body;
      try {
        body = await req.json();
      } catch {
        throw new AppError(400, 'Invalid JSON body');
      }
      const parsed = checkInSchema.parse(body);
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const visitor = await visitorsService.checkIn({ ...parsed, ownerId, recordedBy: ctx.auth.uid });
      return NextResponse.json({ visitor }, { status: 201 });
    },
    { roles: ['owner', 'staff'] }
  )
);
