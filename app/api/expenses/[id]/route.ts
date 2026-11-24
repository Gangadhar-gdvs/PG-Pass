import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { expensesService } from '@/lib/server/services/expenses.service';

export const DELETE = withErrorHandler(
  withAuth(
    withRateLimit(
      async (
        _req: NextRequest,
        ctx: { auth: AuthContext; params: Promise<{ id: string }> }
      ) => {
        const { id } = await ctx.params;
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;
        await expensesService.delete(ownerId, id);
        return NextResponse.json({ success: true });
      },
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['owner', 'staff'] }
  )
);
