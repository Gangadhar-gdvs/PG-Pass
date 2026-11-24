import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { discoveryService } from '@/lib/server/services/discovery.service';

// Public PG search — no auth. Returns only public-safe fields.
export const GET = withErrorHandler(
  withRateLimit(
    async (req: NextRequest) => {
      const url = new URL(req.url);
      const city = url.searchParams.get('city') || undefined;
      const q = url.searchParams.get('q') || undefined;
      const listings = await discoveryService.search({ city, q });
      return NextResponse.json({ listings });
    },
    { tier: 'sensitive', key: 'ip', maxRequests: 60, windowSeconds: 60 }
  )
);
