import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { depositsService } from '@/lib/server/services/deposits.service';

// Pending (not-yet-paid-out) security-deposit refunds for the owner.
export const GET = withErrorHandler(
  withAuth(
    async (_req: NextRequest, ctx: { auth: AuthContext }) => {
      try {
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;
        const refunds = await depositsService.listPendingRefunds(ownerId);
        return NextResponse.json({ refunds });
      } catch (err) {
        console.warn('Failed to list pending refunds:', err);
        return NextResponse.json({ refunds: [] });
      }
    },
    { roles: ['owner', 'staff'] }
  )
);
