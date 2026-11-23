import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { AppError } from './withErrorHandler';
import crypto from 'crypto';

export function withCronAuth(
  handler: (req: NextRequest) => Promise<Response | NextResponse>
) {
  return async (req: NextRequest) => {
    const authHeader = req.headers.get('authorization');
    const expected = `Bearer ${env.CRON_SECRET}`;

    if (!authHeader) {
      throw new AppError(401, 'Missing Authorization header');
    }

    const authBuffer = Buffer.from(authHeader);
    const expectedBuffer = Buffer.from(expected);

    if (
      authBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(authBuffer, expectedBuffer)
    ) {
      throw new AppError(403, 'Invalid CRON_SECRET');
    }

    return handler(req);
  };
}
