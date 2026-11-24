import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { discoveryService } from '@/lib/server/services/discovery.service';

// Public PG detail page — no auth. Listing + gallery photos + reviews + contact.
export const GET = withErrorHandler(
  withRateLimit(
    async (_req: NextRequest, ctx: { params: Promise<{ propertyId: string }> }) => {
      const { propertyId } = await ctx.params;
      const detail = await discoveryService.getListingDetail(propertyId);
      return NextResponse.json(detail);
    },
    { tier: 'sensitive', key: 'ip', maxRequests: 60, windowSeconds: 60 }
  )
);
