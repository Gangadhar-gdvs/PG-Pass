import { NextRequest, NextResponse } from 'next/server';
import { recordSystemLog } from '@/lib/server/services/systemLogs.service';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { z } from 'zod';

const logPayloadSchema = z.object({
  level: z.enum(['info', 'warn', 'error']).default('error'),
  source: z.enum(['client', 'server']).default('client'),
  message: z.string().max(2000),
  code: z.string().max(100).optional(),
  route: z.string().max(300).optional(),
  details: z.any().optional(),
  stack: z.string().max(10000).optional(),
  userAgent: z.string().max(500).optional(),
});

// Hard cap on raw body size so a single caller can't ship megabytes per request
// to this unauthenticated endpoint (each accepted log is a Firestore write).
const MAX_BODY_BYTES = 16 * 1024; // 16 KB

// This endpoint is intentionally public (the client logs errors before/outside
// of an authenticated session), so it is the easiest Spark-write-quota amplifier
// on the surface. Defenses: IP rate limit (sensitive tier, Firestore-backed),
// a strict body-size cap, and strict Zod validation.
export const POST = withErrorHandler(
  withRateLimit(
    async (req: NextRequest) => {
      const raw = await req.text();
      if (raw.length > MAX_BODY_BYTES) {
        return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
      }

      let body: unknown;
      try {
        body = JSON.parse(raw);
      } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
      }

      const parsed = logPayloadSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid log schema' }, { status: 400 });
      }

      const entry = parsed.data;
      const logId = await recordSystemLog({
        level: entry.level,
        source: entry.source,
        message: entry.message,
        code: entry.code,
        route: entry.route,
        details: entry.details,
        stack: entry.stack,
        userAgent: entry.userAgent || req.headers.get('user-agent') || undefined,
      });

      return NextResponse.json({ success: true, logId }, { status: 201 });
    },
    // Firestore-backed so the limit actually holds across serverless instances.
    { tier: 'sensitive', key: 'ip', maxRequests: 30, windowSeconds: 60 }
  )
);
