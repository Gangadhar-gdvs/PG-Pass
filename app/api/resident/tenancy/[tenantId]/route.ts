import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { adminDb } from '@/lib/server/firebase-admin';
import { residentsService } from '@/lib/server/services/residents.service';

/**
 * Full history for one of the resident's tenancies: rent records (all periods),
 * deposit ledger, and maintenance tickets. Authorized by phone match.
 */
export const GET = withErrorHandler(
  withAuth(
    async (
      _req: NextRequest,
      ctx: { auth: AuthContext; params: Promise<{ tenantId: string }> }
    ) => {
      const { tenantId } = await ctx.params;
      const tenant = await residentsService.assertOwnTenant(ctx.auth.uid, tenantId);

      const [rentSnap, depositSnap, ticketSnap, staffSnap] = await Promise.all([
        adminDb
          .collection('rent_records')
          .where('tenantId', '==', tenantId)
          .orderBy('period', 'desc')
          .limit(36)
          .get(),
        adminDb
          .collection('deposits')
          .where('ownerId', '==', tenant.ownerId)
          .where('tenantId', '==', tenantId)
          .orderBy('createdAt', 'desc')
          .limit(50)
          .get(),
        adminDb
          .collection('maintenance_tickets')
          .where('ownerId', '==', tenant.ownerId)
          .where('tenantId', '==', tenantId)
          .orderBy('createdAt', 'desc')
          .limit(50)
          .get(),
        // Active staff of this PG — so the resident can rate individual wardens.
        adminDb
          .collection('staff')
          .where('ownerId', '==', tenant.ownerId)
          .limit(25)
          .get(),
      ]);

      const staff = staffSnap.docs
        .map((d) => d.data())
        .filter((s: any) => s.accountStatus !== 'revoked')
        .map((s: any) => {
          const agg = s.ratingAgg || { count: 0, sum: 0 };
          return {
            uid: s.uid || s.id,
            name: s.name || 'Staff',
            ratingAvg: agg.count > 0 ? Math.round((agg.sum / agg.count) * 10) / 10 : 0,
            ratingCount: agg.count || 0,
          };
        });

      return NextResponse.json({
        tenant: {
          id: tenant.id,
          name: tenant.name,
          ownerId: tenant.ownerId,
          propertyId: tenant.propertyId || tenant.ownerId,
          bedLabel: tenant.bedLabel,
          roomNumber: tenant.roomNumber,
          moveInDate: tenant.moveInDate,
          securityDepositPaise: tenant.securityDepositPaise,
          depositPaidPaise: tenant.depositPaidPaise,
        },
        staff,
        rentHistory: rentSnap.docs.map((d) => ({ ...d.data(), id: d.id })),
        deposits: depositSnap.docs.map((d) => ({ ...d.data(), id: d.id })),
        tickets: ticketSnap.docs.map((d) => ({ ...d.data(), id: d.id })),
      });
    },
    { roles: ['resident'] }
  )
);
