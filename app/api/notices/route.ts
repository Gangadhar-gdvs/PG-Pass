import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { noticesService } from '@/lib/server/services/notices.service';
import { z } from 'zod';

// Owner/staff: list the PG's notices.
export const GET = withErrorHandler(
  withAuth(
    async (_req: NextRequest, ctx: { auth: AuthContext }) => {
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const notices = await noticesService.listForOwner(ownerId);
      return NextResponse.json({ notices });
    },
    { roles: ['owner', 'staff'] }
  )
);

const createSchema = z.object({
  title: z.string().min(2).max(120),
  body: z.string().min(2).max(2000),
  audience: z.enum(['all', 'residents', 'staff']).default('all'),
  roomNumber: z.string().max(20).optional(),
  pinned: z.boolean().optional(),
  expiresAt: z.string().nullable().optional(),
});

// Owner publishes a notice. (Owner only — staff don't broadcast by default.)
export const POST = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext }) => {
      let body;
      try {
        body = await req.json();
      } catch {
        throw new AppError(400, 'Invalid JSON body');
      }
      const parsed = createSchema.parse(body);
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const notice = await noticesService.create({
        ownerId,
        title: parsed.title,
        body: parsed.body,
        audience: parsed.audience,
        roomNumber: parsed.roomNumber,
        pinned: parsed.pinned,
        expiresAt: parsed.expiresAt ?? null,
        createdBy: ctx.auth.uid,
        createdByName: ctx.auth.email,
      });
      return NextResponse.json({ notice }, { status: 201 });
    },
    { roles: ['owner'] }
  )
);
