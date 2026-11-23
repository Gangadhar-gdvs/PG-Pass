import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../firebase-admin';
import { AppError, RouteHandler } from './withErrorHandler';
import crypto from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';

export interface RateLimitOptions {
  tier?: 'standard' | 'sensitive';
  key?: 'ip' | 'uid';
  maxRequests?: number;
  windowSeconds?: number;
}

// In-memory token bucket for Layer 2 (standard routes — 0 DB writes)
interface TokenBucket {
  tokens: number;
  lastRefill: number;
}
const memoryBuckets = new Map<string, TokenBucket>();

function hashIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

export function withRateLimit(
  handler: (req: NextRequest, ctx: any) => Promise<Response | NextResponse>,
  options: RateLimitOptions = {}
): RouteHandler {
  const tier = options.tier || 'standard';
  const keyType = options.key || 'ip';
  const maxRequests = options.maxRequests ?? (tier === 'sensitive' ? 10 : 100);
  const windowSeconds = options.windowSeconds ?? 60;

  return async (req: NextRequest, ctx: any = {}) => {
    let identifier = '';

    if (keyType === 'uid' && ctx?.auth?.uid) {
      identifier = `uid:${ctx.auth.uid}`;
    } else {
      identifier = `ip:${hashIp(req)}`;
    }

    const routePath = req.nextUrl?.pathname || 'default';
    const rateLimitKey = `rl:${routePath.replace(/\//g, '_')}:${identifier}`;

    // 1. Layer 2: In-memory rate limiting (standard tier)
    if (tier === 'standard') {
      const now = Date.now();
      const bucket = memoryBuckets.get(rateLimitKey) || {
        tokens: maxRequests,
        lastRefill: now,
      };

      const elapsedSec = (now - bucket.lastRefill) / 1000;
      const refillAmount = elapsedSec * (maxRequests / windowSeconds);
      bucket.tokens = Math.min(maxRequests, bucket.tokens + refillAmount);
      bucket.lastRefill = now;

      if (bucket.tokens < 1) {
        throw new AppError(429, 'Too many requests. Please try again later.');
      }

      bucket.tokens -= 1;
      memoryBuckets.set(rateLimitKey, bucket);
      return handler(req, ctx);
    }

    // 2. Layer 3: Firestore TTL rate limiting (sensitive tier)
    const rateLimitDocRef = adminDb.collection('rate_limits').doc(rateLimitKey);
    const now = Date.now();
    const windowStartMs = now;
    const expiresAtDate = new Date(now + windowSeconds * 1000);

    try {
      await adminDb.runTransaction(async (transaction) => {
        const doc = await transaction.get(rateLimitDocRef);
        if (!doc.exists) {
          transaction.set(rateLimitDocRef, {
            tokens: maxRequests - 1,
            windowStart: Timestamp.fromMillis(windowStartMs),
            expiresAt: Timestamp.fromDate(expiresAtDate),
          });
          return;
        }

        const data = doc.data()!;
        const docWindowStart = data.windowStart?.toMillis() || 0;
        const isExpired = now - docWindowStart > windowSeconds * 1000;

        if (isExpired) {
          transaction.set(rateLimitDocRef, {
            tokens: maxRequests - 1,
            windowStart: Timestamp.fromMillis(windowStartMs),
            expiresAt: Timestamp.fromDate(expiresAtDate),
          });
          return;
        }

        if (data.tokens <= 0) {
          throw new AppError(429, 'Rate limit exceeded. Please try again later.');
        }

        transaction.update(rateLimitDocRef, {
          tokens: data.tokens - 1,
        });
      });
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      // In case of Firestore connection or transaction error, fail open to not block legitimate users
      console.warn('Firestore rate-limit check failed, falling back:', err);
    }

    return handler(req, ctx);
  };
}
