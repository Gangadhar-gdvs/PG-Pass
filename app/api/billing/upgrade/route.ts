import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { subscriptionsService } from '@/lib/server/services/subscriptions.service';
import { subscriptionUpgradeSchema } from '@/lib/validation';

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

        const validated = subscriptionUpgradeSchema.parse(body);
        const ownerId = ctx.auth.uid; // Only owner can submit plan upgrade

        // Note: amountPaise is intentionally NOT passed — the server computes the
        // canonical price itself so the client can't understate it.
        const result = await subscriptionsService.submitUpgrade({
          ownerId,
          requestedPlan: validated.requestedPlan,
          billingCycle: validated.billingCycle,
          utrReference: validated.utrReference,
        });

        return NextResponse.json({
          success: true,
          request: result,
        });
      },
      { tier: 'sensitive', maxRequests: 5, windowSeconds: 60 }
    ),
    { roles: ['owner'] }
  )
);
