import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { adminDb } from '@/lib/server/firebase-admin';
import { residentsService } from '@/lib/server/services/residents.service';

/**
 * Resident home payload: profile + all linked tenancies (across PGs) enriched
 * with the PG name and current-period rent status.
 */
export const GET = withErrorHandler(
  withAuth(
    async (_req: NextRequest, ctx: { auth: AuthContext }) => {
      const uid = ctx.auth.uid;
      const resident = await residentsService.getResident(uid);
      const tenancies = await residentsService.myTenancies(uid);

      const enriched = await Promise.all(
        tenancies.map(async (t) => {
          // PG name (from the property or legacy owner doc).
          let pgName = '';
          let upiId = '';
          const propSnap = await adminDb
            .collection('properties')
            .doc(t.propertyId || t.ownerId)
            .get();
          if (propSnap.exists) pgName = propSnap.data()?.pgName || '';
          const ownerSnap = await adminDb.collection('owners').doc(t.ownerId).get();
          if (ownerSnap.exists) {
            pgName = pgName || ownerSnap.data()?.pgName || 'PG';
            upiId = ownerSnap.data()?.upiId || '';
          }

          return {
            tenantId: t.id,
            ownerId: t.ownerId,
            propertyId: t.propertyId || t.ownerId,
            pgName,
            upiId,
            bedLabel: t.bedLabel,
            roomNumber: t.roomNumber,
            moveInDate: t.moveInDate,
            active: !t.deletedAt && t.accountStatus !== 'suspended',
          };
        })
      );

      return NextResponse.json({ resident, tenancies: enriched });
    },
    { roles: ['resident'] }
  )
);
