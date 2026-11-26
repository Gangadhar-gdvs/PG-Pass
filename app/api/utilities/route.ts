import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext, AuthedContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { withValidation } from '@/lib/server/api/withValidation';
import { utilitiesService } from '@/lib/server/services/utilities.service';
import { utilityBillInputSchema, type UtilityBillInputData } from '@/lib/validation';
import { isValidPeriod } from '@/lib/utilitySplit';
import { istTodayIso } from '@/lib/assets';

// Utility bills apply charges to residents' rent → OWNER-only (staff blocked).

// List a month's utility bills (incl. voided, for the audit trail).
export const GET = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext }) => {
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const url = new URL(req.url);
      const period = url.searchParams.get('period') || istTodayIso(Date.now()).slice(0, 7);
      if (!isValidPeriod(period)) throw new AppError(400, 'Billing month must be in YYYY-MM format');
      const propertyId = url.searchParams.get('propertyId') || undefined;
      const bills = await utilitiesService.list(ownerId, period, propertyId);
      return NextResponse.json({ bills, period });
    },
    { roles: ['owner'] }
  )
);

// Save a utility bill as a draft (allocation computed + frozen server-side).
export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      withValidation<UtilityBillInputData, AuthedContext>(utilityBillInputSchema)(async (_req, ctx) => {
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;
        const bill = await utilitiesService.create(ownerId, ctx.auth.uid, ctx.data);
        return NextResponse.json({ success: true, bill }, { status: 201 });
      }),
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['owner'] }
  )
);
