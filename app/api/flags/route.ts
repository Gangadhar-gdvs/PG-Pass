import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { adminDb } from '@/lib/server/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

const createFlagSchema = z.object({
  targetType: z.enum(['photo', 'rent', 'deposit', 'tenant', 'other']),
  targetId: z.string().min(1),
  reason: z.string().min(5, 'Please provide details about the issue'),
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

        const { targetType, targetId, reason } = createFlagSchema.parse(body);

        const flagRef = adminDb.collection('support_flags').doc();
        const now = Timestamp.now();

        await flagRef.set({
          id: flagRef.id,
          reportedBy: ctx.auth.uid,
          reporterRole: ctx.auth.role,
          targetType,
          targetId,
          reason,
          status: 'open',
          resolvedBy: null,
          resolvedAt: null,
          createdAt: now,
        });

        return NextResponse.json({
          success: true,
          flagId: flagRef.id,
          message: 'Support flag submitted for administrator review',
        });
      },
      { tier: 'standard' }
    ),
    { roles: ['owner', 'staff', 'admin'] }
  )
);
