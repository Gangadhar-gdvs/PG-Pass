'use client';

import toast from 'react-hot-toast';
import { errorMessage } from '@/lib/utils';

/**
 * Email ONE resident their rent reminder from the owner's connected Gmail, with
 * consistent outcome handling (shared by the bed drawer and the reminder modal):
 *  - sent        → success toast
 *  - no email    → the resident has no linked email; offer the WhatsApp fallback
 *  - no Gmail    → prompt the owner to connect Gmail in Settings
 *
 * Returns `true` only when the email was actually sent (so callers can stamp
 * "reminded" / update local state). Never throws — surfaces a toast instead.
 *
 * `onWhatsAppFallback` (optional) is invoked when the resident has no email, so
 * the caller can open WhatsApp for that resident instead.
 *
 * `isStaff` — staff can SEND from the owner's Gmail but cannot CONNECT it
 * (/settings is owner-only), so for staff the not-connected prompt is a message
 * to ask the owner, NOT a dead-end "Connect" button that would bounce them.
 */
export async function emailRentReminder(
  rentRecordId: string,
  opts: { tenantName?: string; isStaff?: boolean; onWhatsAppFallback?: () => void } = {}
): Promise<boolean> {
  try {
    const res = await fetch(`/api/rent/${rentRecordId}/send-email-reminder`, { method: 'POST' });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (data.code === 'GMAIL_NOT_CONNECTED') {
        if (opts.isStaff) {
          // Staff can't open owner-only Settings — tell them to ask the owner.
          toast('Email reminders need the PG owner to connect their Gmail. Use WhatsApp for now.');
          opts.onWhatsAppFallback?.();
        } else {
          // Owner: offer a one-tap path to connect Gmail rather than just naming Settings.
          toast(
            (t) => (
              <span className="flex items-center gap-3">
                <span>Connect your Gmail to email reminders.</span>
                <button
                  type="button"
                  onClick={() => {
                    toast.dismiss(t.id);
                    // Full navigation (not router.push) is intentional: this helper
                    // is a plain function with no router, and a fresh Settings load
                    // re-runs the server auth gate + lands on the #gmail anchor.
                    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                    window.location.href = '/settings#gmail';
                  }}
                  className="shrink-0 rounded-full bg-brand px-3 py-1 text-[12px] font-bold text-white"
                >
                  Connect
                </button>
              </span>
            ),
            { duration: 6000 }
          );
        }
      } else if (data.code === 'GMAIL_UNAVAILABLE') {
        toast('Email reminders aren’t enabled — use WhatsApp instead.');
        opts.onWhatsAppFallback?.();
      } else {
        toast.error(errorMessage(new Error(data.error || ''), 'Could not send the email reminder.'));
      }
      return false;
    }

    // 200 but not sent → this specific resident has no email on file.
    if (data.sent === false && data.code === 'NO_RESIDENT_EMAIL') {
      const who = data.tenantName || opts.tenantName || 'This resident';
      toast(`${who} has no email on file — send a WhatsApp reminder instead.`);
      opts.onWhatsAppFallback?.();
      return false;
    }

    toast.success(`Emailed a reminder to ${data.tenantName || opts.tenantName || 'the resident'}.`);
    return true;
  } catch (e) {
    toast.error(errorMessage(e, 'Could not send the email reminder.'));
    return false;
  }
}
