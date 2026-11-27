import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler, AppError } from '@/lib/server/api/withErrorHandler';
import { withAuth, AuthContext } from '@/lib/server/api/withAuth';
import { withRateLimit } from '@/lib/server/api/withRateLimit';
import { rentService } from '@/lib/server/services/rent.service';
import { ownersService } from '@/lib/server/services/owners.service';
import { getOwnerGmailStatus } from '@/lib/server/services/gmail.service';
import { recordEvent } from '@/lib/server/services/systemLogs.service';
import { STAFF_PERMISSIONS } from '@/lib/constants/permissions';
import { RENT_STATUS } from '@/lib/constants/status';

/**
 * Email ONE resident their rent reminder from the owner's connected Gmail.
 * The bulk "email all unpaid" button lives at /api/rent/send-reminders; this is
 * the single-resident counterpart (from a bed drawer / reminder-modal row).
 *
 * Returns distinct codes so the UI can react precisely:
 *  - GMAIL_UNAVAILABLE / GMAIL_NOT_CONNECTED → prompt the owner to connect Gmail
 *  - outcome 'no_email' → this resident has no email; tell the owner to WhatsApp
 */
export const POST = withErrorHandler(
  withAuth(
    withRateLimit(
      async (req: NextRequest, ctx: { auth: AuthContext; params: Promise<{ id: string }> }) => {
        const { id: recordId } = await ctx.params;
        const ownerId = ctx.auth.ownerId || ctx.auth.uid;

        const gmail = await getOwnerGmailStatus(ownerId);
        if (!gmail.available) {
          throw new AppError(400, 'Email reminders are not enabled on this server.', 'GMAIL_UNAVAILABLE');
        }
        if (!gmail.connected) {
          throw new AppError(400, 'Connect your Gmail in Settings to send email reminders.', 'GMAIL_NOT_CONNECTED');
        }

        // Ownership (403 if not this owner's record) + must be unpaid.
        const record = await rentService.getRentRecord(recordId, ownerId);
        if (record.status === RENT_STATUS.PAID) {
          throw new AppError(400, 'This rent is already paid — nothing to remind.');
        }

        const profile = await ownersService.getProfile(ownerId);
        const pgName = profile?.pgName || 'Your PG';
        const upiId = profile?.upiId || '';

        const result = await rentService.sendEmailReminderForRecord({ ownerId, record, pgName, upiId });

        if (result.outcome === 'no_email') {
          // Not an error the owner can't act on — the UI offers a WhatsApp fallback.
          return NextResponse.json(
            { sent: false, code: 'NO_RESIDENT_EMAIL', tenantName: result.tenantName },
            { status: 200 }
          );
        }
        if (result.outcome === 'failed') {
          throw new AppError(502, 'Could not send the email from your Gmail. Please try again.');
        }

        await recordEvent({
          category: 'comms',
          level: 'info',
          message: `Gmail rent reminder (single) sent to ${result.tenantName}`,
          ownerId,
          targetId: recordId,
        }).catch(() => {});

        return NextResponse.json({ sent: true, email: result.email, tenantName: result.tenantName });
      },
      { tier: 'sensitive', key: 'uid', maxRequests: 30, windowSeconds: 300 }
    ),
    { roles: ['owner', 'staff'], permission: STAFF_PERMISSIONS.COLLECT_RENT }
  )
);
