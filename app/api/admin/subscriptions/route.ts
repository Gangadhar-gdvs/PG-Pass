import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { subscriptionsService } from '@/lib/server/services/subscriptions.service';
import { adminDb } from '@/lib/server/firebase-admin';
import { ADMIN_PERMISSIONS } from '@/lib/constants/permissions';

export const GET = withErrorHandler(
  withAuth(
    async () => {
      const snap = await adminDb
        .collection('subscription_requests')
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      const requests = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return NextResponse.json({ requests });
    },
    { roles: ['admin'], adminPermission: ADMIN_PERMISSIONS.SUBSCRIPTIONS_MANAGE }
  )
);

export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (req: NextRequest, ctx: { auth: AuthContext }) => {
        let body: { requestId?: string; action?: 'approve' | 'reject' };
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }

        if (!body.requestId) throw new AppError(400, 'requestId is required');

        if (body.action === 'approve') {
          await subscriptionsService.approveUpgrade(body.requestId, ctx.auth.uid);
          return NextResponse.json({ success: true, message: 'Plan upgrade approved' });
        }

        throw new AppError(400, 'Invalid action');
      },
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['admin'], adminPermission: ADMIN_PERMISSIONS.SUBSCRIPTIONS_MANAGE }
  )
);
