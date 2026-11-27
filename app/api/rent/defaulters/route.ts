import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { rentService } from '@/lib/server/services/rent.service';
import { todayIST } from '@/lib/utils';
import { STAFF_PERMISSIONS } from '@/lib/constants/permissions';

// Defaulter / aging report for the owner dashboard: overdue unpaid rent records
// ranked by days overdue, with accrued late fee and outstanding amount.
export const GET = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext }) => {
      try {
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;
        const todayIso = todayIST();
        const defaulters = await rentService.getDefaulters(ownerId, todayIso);
        return NextResponse.json({ defaulters });
      } catch (err) {
        console.warn('Failed to get defaulters:', err);
        return NextResponse.json({ defaulters: [] });
      }
    },
    { roles: ['owner', 'staff'], anyPermission: [STAFF_PERMISSIONS.MANAGE_TENANTS, STAFF_PERMISSIONS.COLLECT_RENT] }
  )
);
