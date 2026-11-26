import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../firebase-admin';
import { AppError } from './withErrorHandler';
import crypto from 'crypto';
import { Timestamp } from 'firebase-admin/firestore';

type AuthLikeContext = { auth?: { uid?: string } };

export interface RateLimitOptions {
  tier?: 'standard' | 'sensitive';
  key?: 'ip' | 'uid';
  maxRequests?: number;
  windowSeconds?: number;
}

/**
 * In-memory token bucket for the `standard` tier (0 Firestore writes).
 *
 * IMPORTANT: this is per-instance and therefore BEST-EFFORT only. On a
 * serverless / multi-instance host each instance keeps its own Map, so the
 * effective limit is `maxRequests × instanceCount` and resets on cold start.
 * It is a cheap guard against a single hot client, NOT a hard global limit.
 *
 * For hard, cross-instance limits use `tier: 'sensitive'` (Firestore-backed,
 * below) — that is what every unauthenticated / abuse-prone endpoint uses
 * (auth/session, portal unlock, rent claim, logs). The durable production
 * answer for the standard tier is an edge limiter (Cloudflare WAF, see §17.2),
 * which this layer intentionally does not try to replace.
 */
interface TokenBucket {
  tokens: number;
  lastRefill: number;
}
const memoryBuckets = new Map<string, TokenBucket>();

// Bound the Map so a long-lived instance seeing many distinct IPs doesn't leak
// memory indefinitely. Evict buckets untouched for > 10 minutes, and hard-cap
// total entries.
const BUCKET_TTL_MS = 10 * 60 * 1000;
const MAX_BUCKETS = 10_000;
function evictStaleBuckets(now: number) {
  if (memoryBuckets.size < MAX_BUCKETS) {
    // Cheap amortized sweep: only scan when we cross the cap.
    return;
  }
  for (const [key, bucket] of memoryBuckets) {
    if (now - bucket.lastRefill > BUCKET_TTL_MS) {
      memoryBuckets.delete(key);
    }
  }
  // If still over cap after TTL eviction, drop oldest arbitrary entries.
  if (memoryBuckets.size >= MAX_BUCKETS) {
    const overflow = memoryBuckets.size - MAX_BUCKETS + 1;
    let i = 0;
    for (const key of memoryBuckets.keys()) {
      memoryBuckets.delete(key);
      if (++i >= overflow) break;
    }
  }
}

function hashIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
  return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

export function withRateLimit<C>(
  handler: (req: NextRequest, ctx: C) => Promise<Response | NextResponse>,
  options: RateLimitOptions = {}
): (req: NextRequest, ctx: C) => Promise<Response | NextResponse> {
  const tier = options.tier || 'standard';
  const keyType = options.key || 'ip';
  const maxRequests = options.maxRequests ?? (tier === 'sensitive' ? 10 : 100);
  const windowSeconds = options.windowSeconds ?? 60;

  return async (req: NextRequest, ctx: C) => {
    let identifier = '';

    const authUid = (ctx as AuthLikeContext | undefined)?.auth?.uid;
    if (keyType === 'uid' && authUid) {
      identifier = `uid:${authUid}`;
    } else {
      identifier = `ip:${hashIp(req)}`;
    }

    const routePath = req.nextUrl?.pathname || 'default';
    const rateLimitKey = `rl:${routePath.replace(/\//g, '_')}:${identifier}`;

    // 1. Layer 2: In-memory rate limiting (standard tier)
    if (tier === 'standard') {
      const now = Date.now();
      evictStaleBuckets(now);
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
