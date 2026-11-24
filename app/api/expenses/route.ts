import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { expensesService } from '@/lib/server/services/expenses.service';
import { STAFF_PERMISSIONS, PG_FEATURES } from '@/lib/constants/permissions';

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// List expenses for a billing period (defaults to current month).
export const GET = withErrorHandler(
  withAuth(
    async (req: NextRequest, ctx: { auth: AuthContext }) => {
      const ownerId = ctx.auth.ownerId || ctx.auth.uid;
      const period = new URL(req.url).searchParams.get('period') || currentPeriod();
      const expenses = await expensesService.listByPeriod(ownerId, period);
      const total = expenses.reduce((s, e) => s + (e.amountPaise || 0), 0);
      return NextResponse.json({ expenses, total, period });
    },
    { roles: ['owner', 'staff'], feature: PG_FEATURES.EXPENSES }
  )
);

// Record a new expense.
export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (req: NextRequest, ctx: { auth: AuthContext }) => {
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;
        let body: {
          category?: string;
          amountRupees?: number;
          amountPaise?: number;
          note?: string;
          vendor?: string;
          date?: string;
        };
        try {
          body = await req.json();
        } catch {
          throw new AppError(400, 'Invalid JSON body');
        }

        const amountPaise =
          body.amountPaise ??
          (typeof body.amountRupees === 'number' ? Math.round(body.amountRupees * 100) : undefined);
        if (!amountPaise || amountPaise <= 0) throw new AppError(400, 'A positive amount is required');

        const expense = await expensesService.create(ownerId, ctx.auth.uid, {
          category: body.category || 'other',
          amountPaise,
          note: body.note,
          vendor: body.vendor,
          date: body.date || new Date().toISOString().slice(0, 10),
        });

        return NextResponse.json({ success: true, expense }, { status: 201 });
      },
      { tier: 'standard', key: 'uid' }
    ),
    { roles: ['owner', 'staff'], permission: STAFF_PERMISSIONS.MANAGE_EXPENSES, feature: PG_FEATURES.EXPENSES }
  )
);
