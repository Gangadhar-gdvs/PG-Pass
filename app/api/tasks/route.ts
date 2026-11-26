import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { tasksService } from '@/lib/server/services/tasks.service';
import type { StaffTaskStatus } from '@/types';
import { z } from 'zod';

// Owner sees all tasks; staff see tasks assigned to them or general (unassigned).
export const GET = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext }) => {
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const url = new URL(req.url);
      const status = (url.searchParams.get('status') as StaffTaskStatus | null) || undefined;
      const forStaffUid = ctx.auth.role === 'staff' ? ctx.auth.uid : undefined;
      const tasks = await tasksService.list(ownerId, { forStaffUid, status });
      return NextResponse.json({ tasks });
    },
    { roles: ['owner', 'staff'] }
  )
);

const createSchema = z.object({
  title: z.string().min(2).max(140),
  note: z.string().max(500).optional(),
  assignedToUid: z.string().optional(),
  assignedToName: z.string().optional(),
  dueDate: z.string().optional(),
});

// Owner assigns a task.
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
      const task = await tasksService.create({ ...parsed, ownerId, createdBy: ctx.auth.uid });
      return NextResponse.json({ task }, { status: 201 });
    },
    { roles: ['owner'] }
  )
);
