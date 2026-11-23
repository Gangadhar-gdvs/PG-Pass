import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withCronAuth } from '@/lib/server/api/withCronAuth';
import { adminDb } from '@/lib/server/firebase-admin';
import { RENT_STATUS, ACCOUNT_STATUS } from '@/lib/constants/status';
import { Timestamp } from 'firebase-admin/firestore';

export const POST = withErrorHandler(
  withCronAuth(async (req: NextRequest) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const now = Timestamp.now();

    // 1. Compute platform metrics
    const ownersSnap = await adminDb.collection('owners').where('accountStatus', '==', ACCOUNT_STATUS.ACTIVE).count().get();
    const tenantsSnap = await adminDb.collection('tenants').where('deletedAt', '==', null).count().get();
    const bedsSnap = await adminDb.collection('beds').count().get();

    const activeOwnersCount = ownersSnap.data().count;
    const activeResidentsCount = tenantsSnap.data().count;
    const totalBedsCount = bedsSnap.data().count;

    // 2. Identify stale verify claims (> 3 days unconfirmed)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const staleClaimsSnap = await adminDb
      .collection('rent_records')
      .where('status', '==', RENT_STATUS.VERIFY)
      .where('claimedAt', '<=', Timestamp.fromDate(threeDaysAgo))
      .limit(50)
      .get();

    const staleCount = staleClaimsSnap.size;

    // 3. Write metrics/{todayStr}
    await adminDb.collection('metrics').doc(todayStr).set({
      date: todayStr,
      activeOwnersCount,
      activeResidentsCount,
      totalBedsCount,
      staleClaimsCount: staleCount,
      updatedAt: now,
    });

    // 4. Auto-generate next-period pending rent records for all active tenants
    const nextMonthDate = new Date();
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    const nextPeriod = nextMonthDate.toISOString().slice(0, 7); // YYYY-MM

    const activeTenantsSnap = await adminDb
      .collection('tenants')
      .where('deletedAt', '==', null)
      .limit(100)
      .get();

    let generatedCount = 0;
    const batch = adminDb.batch();

    for (const tenantDoc of activeTenantsSnap.docs) {
      const tenant = tenantDoc.data();
      const docId = `${tenantDoc.id}_${nextPeriod}`;
      const rentRef = adminDb.collection('rent_records').doc(docId);

      // Check if already generated (idempotent)
      const existing = await rentRef.get();
      if (!existing.exists) {
        // Fetch bed to get current rent
        let rentAmountPaise = 800000; // fallback 8000
        if (tenant.bedId) {
          const bedDoc = await adminDb.collection('beds').doc(tenant.bedId).get();
          if (bedDoc.exists) {
            rentAmountPaise = bedDoc.data()?.rentAmountPaise || rentAmountPaise;
          }
        }

        batch.set(rentRef, {
          id: docId,
          ownerId: tenant.ownerId,
          tenantId: tenantDoc.id,
          tenantName: tenant.name,
          period: nextPeriod,
          roomNumber: tenant.roomNumber || 'Unknown',
          bedLabel: tenant.bedLabel || 'Bed',
          lineItems: [{ label: 'Base Rent', amountPaise: rentAmountPaise }],
          prorated: false,
          amountDuePaise: rentAmountPaise,
          amountPaidPaise: 0,
          status: RENT_STATUS.PENDING,
          dueDate: `${nextPeriod}-05`,
          createdAt: now,
          updatedAt: now,
        });
        generatedCount++;
      }
    }

    if (generatedCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      metricsDate: todayStr,
      generatedRentRecords: generatedCount,
      staleClaimsFound: staleCount,
    });
  })
);
