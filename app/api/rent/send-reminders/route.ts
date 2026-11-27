import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { adminDb } from '@/lib/server/firebase-admin';
import { getOwnerGmailStatus } from '@/lib/server/services/gmail.service';
import { rentService } from '@/lib/server/services/rent.service';
import { recordEvent } from '@/lib/server/services/systemLogs.service';
import { STAFF_PERMISSIONS } from '@/lib/constants/permissions';
import { getCurrentPeriod } from '@/lib/utils';
import type { RentRecord } from '@/types';

/**
 * ONE-BUTTON "send rent reminders from my own Gmail". Finds this period's unpaid
 * rent records, looks up each resident's email, and emails them directly from the
 * owner's connected Gmail — no manual Gmail, no WhatsApp tabs. Idempotency is
 * soft (we stamp lastRemindedAt); residents without an email are skipped and
 * reported so the owner can WhatsApp those.
 */
export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (req: NextRequest, ctx: { auth: AuthContext }) => {
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;

        const gmail = await getOwnerGmailStatus(ownerId);
        if (!gmail.available) throw new AppError(400, 'Email reminders are not enabled on this server.', 'GMAIL_UNAVAILABLE');
        if (!gmail.connected) throw new AppError(400, 'Connect your Gmail in Settings to send email reminders.', 'GMAIL_NOT_CONNECTED');

        let body: { period?: string } = {};
        try {
          body = await req.json();
        } catch {
          /* period optional */
        }
        const period = body.period || getCurrentPeriod();

        // Owner profile for PG name + the from-name on the email.
        const ownerSnap = await adminDb.collection('owners').doc(ownerId).get();
        const pgName = (ownerSnap.data()?.pgName as string) || 'Your PG';
        const upiId = (ownerSnap.data()?.upiId as string) || '';

        // Unpaid records this period.
        const snap = await adminDb
          .collection('rent_records')
          .where('ownerId', '==', ownerId)
          .where('period', '==', period)
          .limit(200)
          .get();
        const unpaid = snap.docs
          .map((d) => ({ ...d.data(), id: d.id } as RentRecord))
          .filter((r) => r.status !== 'paid');

        let sent = 0;
        const skipped: Array<{ tenantName?: string; reason: string }> = [];

        // Per-record resolve-email → send → stamp is shared with the single-
        // resident route via rentService.sendEmailReminderForRecord (one source
        // of truth for the email body + lastRemindedAt stamp).
        for (const r of unpaid) {
          const result = await rentService.sendEmailReminderForRecord({ ownerId, record: r, pgName, upiId });
          if (result.outcome === 'sent') {
            sent++;
          } else {
            skipped.push({
              tenantName: result.tenantName,
              reason: result.outcome === 'no_email' ? 'no email on file' : 'send failed',
            });
          }
        }

        await recordEvent({
          category: 'comms',
          level: 'info',
          message: `Gmail rent reminders: ${sent} sent, ${skipped.length} skipped (${period})`,
          ownerId,
        });

        return NextResponse.json({ sent, skippedCount: skipped.length, skipped });
      },
      { tier: 'sensitive', key: 'uid', maxRequests: 6, windowSeconds: 300 }
    ),
    { roles: ['owner', 'staff'], permission: STAFF_PERMISSIONS.COLLECT_RENT }
  )
);
