import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withCronAuth } from '@/lib/server/api/withCronAuth';
import { adminDb } from '@/lib/server/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export const POST = withErrorHandler(
  withCronAuth(async () => {
    const now = Date.now();
    let purgedTenantsCount = 0;
    let purgedTokensCount = 0;
    let purgedLockoutsCount = 0;

    // 1. Purge soft-deleted tenants older than 7 days
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const deletedTenantsSnap = await adminDb
      .collection('tenants')
      .where('deletedAt', '<=', Timestamp.fromDate(sevenDaysAgo))
      .limit(50)
      .get();

    for (const doc of deletedTenantsSnap.docs) {
      await doc.ref.delete();
      purgedTenantsCount++;
    }

    // 2. Clean expired portal tokens older than 30 days past expiry
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const expiredTokensSnap = await adminDb
      .collection('portal_tokens')
      .where('expiresAt', '<=', Timestamp.fromDate(thirtyDaysAgo))
      .limit(50)
      .get();

    for (const doc of expiredTokensSnap.docs) {
      await doc.ref.delete();
      purgedTokensCount++;
    }

    // 3. Clean expired portal_lockouts
    const expiredLockoutsSnap = await adminDb
      .collection('portal_lockouts')
      .where('expiresAt', '<=', Timestamp.fromDate(new Date(now)))
      .limit(50)
      .get();

    for (const doc of expiredLockoutsSnap.docs) {
      await doc.ref.delete();
      purgedLockoutsCount++;
    }

    return NextResponse.json({
      success: true,
      purgedTenants: purgedTenantsCount,
      purgedTokens: purgedTokensCount,
      purgedLockouts: purgedLockoutsCount,
    });
  })
);
