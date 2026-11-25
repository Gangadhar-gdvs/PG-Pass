import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withCronAuth } from '@/lib/server/api/withCronAuth';
import { adminDb } from '@/lib/server/firebase-admin';
import { Timestamp, Query } from 'firebase-admin/firestore';

/**
 * Delete every doc matching `query`, in batched pages, until drained or a hard
 * safety cap is hit (so a single cron run can't run unbounded). Replaces the old
 * `limit(50)` + per-doc `.delete()` which never caught up on a backlog and was
 * slow (one round-trip per doc). Returns the number deleted.
 */
async function purgeQuery(query: Query, maxDocs = 5000): Promise<number> {
  const PAGE = 300;
  let deleted = 0;
  for (;;) {
    if (deleted >= maxDocs) break;
    const snap = await query.limit(PAGE).get();
    if (snap.empty) break;
    const batch = adminDb.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < PAGE) break;
  }
  return deleted;
}

export const POST = withErrorHandler(
  withCronAuth(async () => {
    const now = Date.now();
    const daysAgo = (d: number) => Timestamp.fromDate(new Date(now - d * 24 * 60 * 60 * 1000));

    // 1. Soft-deleted tenants older than 7 days.
    const purgedTenants = await purgeQuery(
      adminDb.collection('tenants').where('deletedAt', '<=', daysAgo(7))
    );

    // 2. Portal tokens 30+ days past expiry.
    const purgedTokens = await purgeQuery(
      adminDb.collection('portal_tokens').where('expiresAt', '<=', daysAgo(30))
    );

    // 3. Expired portal lockouts.
    const purgedLockouts = await purgeQuery(
      adminDb.collection('portal_lockouts').where('expiresAt', '<=', Timestamp.fromDate(new Date(now)))
    );

    // 4. Expired rate-limit buckets (belt-and-braces alongside the TTL policy).
    const purgedRateLimits = await purgeQuery(
      adminDb.collection('rate_limits').where('expiresAt', '<=', Timestamp.fromDate(new Date(now)))
    );

    // 5. Diagnostic system_logs older than 90 days. NOTE: audit_logs are
    //    intentionally NOT purged here — they are immutable financial/security
    //    records with a much longer (or indefinite) retention requirement.
    const purgedSystemLogs = await purgeQuery(
      adminDb.collection('system_logs').where('createdAt', '<=', daysAgo(90))
    );

    return NextResponse.json({
      success: true,
      purgedTenants,
      purgedTokens,
      purgedLockouts,
      purgedRateLimits,
      purgedSystemLogs,
    });
  })
);
