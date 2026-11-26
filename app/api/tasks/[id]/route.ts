import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { tasksService } from '@/lib/server/services/tasks.service';
import { z } from 'zod';

const patchSchema = z.object({ status: z.enum(['open', 'done']) });

// Owner or staff toggles a task done/open.
export const PATCH = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext; params: Promise<{ id: string }> }) => {
      const { id } = await ctx.params;
      if (!id) throw new AppError(400, 'Task id required');
      let body;
      try {
        body = await req.json();
      } catch {
        throw new AppError(400, 'Invalid JSON body');
      }
      const { status } = patchSchema.parse(body);
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const task = await tasksService.setStatus(id, ownerId, status, ctx.auth.uid);
      return NextResponse.json({ task });
    },
    { roles: ['owner', 'staff'] }
  )
);

// Owner deletes a task.
export const DELETE = withErrorHandler(
  withAuth(
    async (_req: NextRequest, ctx: { auth: AuthContext; params: Promise<{ id: string }> }) => {
      const { id } = await ctx.params;
      if (!id) throw new AppError(400, 'Task id required');
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      await tasksService.softDelete(id, ownerId);
      return NextResponse.json({ success: true });
    },
    { roles: ['owner'] }
  )
);
