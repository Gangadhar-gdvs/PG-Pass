import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withCronAuth } from '@/lib/server/api/withCronAuth';
import { adminDb } from '@/lib/server/firebase-admin';
import { RENT_STATUS, ACCOUNT_STATUS } from '@/lib/constants/status';
import { rentDueDate } from '@/lib/utils';
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

    // 4. Auto-generate next-period pending rent records for ALL active tenants.
    //    Paginated (no silent 100-tenant cap) with per-owner due-day caching to
    //    avoid an owner read per tenant.
    const nextMonthDate = new Date();
    nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
    const nextPeriod = nextMonthDate.toISOString().slice(0, 7); // YYYY-MM

    const ownerDueDayCache = new Map<string, number | undefined>();
    async function dueDayFor(ownerId: string): Promise<number | undefined> {
      if (ownerDueDayCache.has(ownerId)) return ownerDueDayCache.get(ownerId);
      const snap = await adminDb.collection('owners').doc(ownerId).get();
      const dueDay = snap.exists ? (snap.data()?.rentDueDay as number | undefined) : undefined;
      ownerDueDayCache.set(ownerId, dueDay);
      return dueDay;
    }

    let generatedCount = 0;
    let processedTenants = 0;
    const PAGE = 300;
    // Firestore QueryDocumentSnapshot cursor; typed loosely to avoid the global
    // FirebaseFirestore namespace.
    let lastTenant: any = undefined;
    let batch = adminDb.batch();
    let batchOps = 0;

    for (;;) {
      let tq = adminDb
        .collection('tenants')
        .where('deletedAt', '==', null)
        .orderBy('__name__')
        .limit(PAGE);
      if (lastTenant) tq = tq.startAfter(lastTenant);
      const page = await tq.get();
      if (page.empty) break;

      for (const tenantDoc of page.docs) {
        processedTenants++;
        const tenant = tenantDoc.data();
        const docId = `${tenantDoc.id}_${nextPeriod}`;
        const rentRef = adminDb.collection('rent_records').doc(docId);

        const existing = await rentRef.get();
        if (existing.exists) continue;

        let rentAmountPaise = 800000; // fallback 8000
        if (tenant.bedId) {
          const bedDoc = await adminDb.collection('beds').doc(tenant.bedId).get();
          if (bedDoc.exists) {
            rentAmountPaise = bedDoc.data()?.rentAmountPaise || rentAmountPaise;
          }
        }

        const dueDay = await dueDayFor(tenant.ownerId);

        batch.set(rentRef, {
          id: docId,
          ownerId: tenant.ownerId,
          propertyId: tenant.propertyId || tenant.ownerId,
          tenantId: tenantDoc.id,
          tenantName: tenant.name,
          bedId: tenant.bedId || null,
          period: nextPeriod,
          roomNumber: tenant.roomNumber || 'Unknown',
          bedLabel: tenant.bedLabel || 'Bed',
          lineItems: [{ label: 'Base Rent', amountPaise: rentAmountPaise }],
          prorated: false,
          amountDuePaise: rentAmountPaise,
          amountPaidPaise: 0,
          status: RENT_STATUS.PENDING,
          dueDate: rentDueDate(nextPeriod, dueDay),
          createdAt: now,
          updatedAt: now,
        });
        generatedCount++;
        batchOps++;

        // Firestore batches cap at 500 writes; commit and start a new one.
        if (batchOps >= 450) {
          await batch.commit();
          batch = adminDb.batch();
          batchOps = 0;
        }
      }

      lastTenant = page.docs[page.docs.length - 1];
      if (page.size < PAGE) break;
    }

    if (batchOps > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      metricsDate: todayStr,
      processedTenants,
      generatedRentRecords: generatedCount,
      staleClaimsFound: staleCount,
    });
  })
);
