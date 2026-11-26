import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthedContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { withValidation } from '@/lib/server/api/withValidation';
import { utilitiesService } from '@/lib/server/services/utilities.service';
import { utilityBillInputSchema, type UtilityBillInputData } from '@/lib/validation';

// Dry-run split for the "New bill" sheet: residents in scope, per-resident
// shares + rounding, and duplicate/overlap warnings. Never writes.
export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      withValidation<UtilityBillInputData, AuthedContext>(utilityBillInputSchema)(async (_req, ctx) => {
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;
        const preview = await utilitiesService.preview(ownerId, ctx.data);
        return NextResponse.json({ preview });
      }),
      { tier: 'standard', key: 'uid', maxRequests: 120 }
    ),
    { roles: ['owner'] }
  )
);
