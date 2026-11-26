import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { adminDb } from '@/lib/server/firebase-admin';
import { sendFromOwnerGmail, getOwnerGmailStatus } from '@/lib/server/services/gmail.service';
import { residentsService } from '@/lib/server/services/residents.service';
import { recordEvent } from '@/lib/server/services/systemLogs.service';
import { STAFF_PERMISSIONS } from '@/lib/constants/permissions';
import { formatCurrency } from '@/lib/utils';
import { Timestamp } from 'firebase-admin/firestore';
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
        const period = body.period || new Date().toISOString().slice(0, 7);

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

        for (const r of unpaid) {
          // Need the tenant's phone to resolve a linked resident email.
          let phone = '';
          let tenantName = r.tenantName || 'Resident';
          if (r.tenantId) {
            const tSnap = await adminDb.collection('tenants').doc(r.tenantId).get();
            phone = (tSnap.data()?.phone as string) || '';
            tenantName = (tSnap.data()?.name as string) || tenantName;
          }
          const email = phone ? await residentsService.emailForPhone(phone) : null;
          if (!email) {
            skipped.push({ tenantName, reason: 'no email on file' });
            continue;
          }

          const due = (r.amountDuePaise ?? 0) / 100;
          const paid = (r.amountPaidPaise ?? 0) / 100;
          const outstanding = Math.max(0, due - paid);
          const amountStr = formatCurrency(outstanding);
          const html = `
            <div style="font-family:Arial,sans-serif;font-size:14px;color:#0F172A;line-height:1.6">
              <p>Namaste ${tenantName},</p>
              <p>This is a friendly reminder that your rent for <b>${period}</b> at <b>${pgName}</b> is pending.</p>
              <p><b>Amount due: ${amountStr}</b></p>
              ${upiId ? `<p>You can pay directly via UPI: <b>${upiId}</b></p>` : ''}
              <p>Thank you,<br/>${pgName}</p>
            </div>`;

          const ok = await sendFromOwnerGmail(ownerId, {
            to: email,
            subject: `Rent reminder — ${pgName} (${period})`,
            html,
            fromName: pgName,
          }).catch(() => false);

          if (ok) {
            sent++;
            if (r.id) {
              await adminDb.collection('rent_records').doc(r.id).update({ lastRemindedAt: Timestamp.now() }).catch(() => {});
            }
          } else {
            skipped.push({ tenantName, reason: 'send failed' });
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
