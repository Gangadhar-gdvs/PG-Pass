import 'server-only';
import { env } from '@/lib/env';
import { logger } from '../monitoring/logger';

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Transactional email sender.
 *
 * Deliberately provider-light: uses the Resend HTTP API via `fetch` (no SDK
 * dependency) and is a **no-op when unconfigured**, so the app stays
 * zero-cost/card-free by default. Set `RESEND_API_KEY` + `EMAIL_FROM` to enable.
 *
 * All sends are best-effort: a failure is logged but never throws into the
 * caller's business transaction (a receipt email must not fail a payment).
 */
export class EmailService {
  get isConfigured(): boolean {
    return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
  }

  async send(params: SendEmailParams): Promise<boolean> {
    if (!this.isConfigured) return false;
    if (!params.to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(params.to)) return false;

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: env.EMAIL_FROM,
          to: params.to,
          subject: params.subject,
          html: params.html,
        }),
      });
      if (!res.ok) {
        logger.warn('email.send.failed', { status: res.status });
        return false;
      }
      return true;
    } catch (err) {
      logger.warn('email.send.error', { error: (err as Error).message });
      return false;
    }
  }
}

export const emailService = new EmailService();

// ---- Small HTML templates (inline-styled for mail-client compatibility) ----

function wrap(title: string, body: string): string {
  return `<div style="font-family:system-ui,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#09090B">
    <h2 style="margin:0 0 12px;font-size:18px">${title}</h2>
    ${body}
    <p style="margin-top:24px;font-size:12px;color:#94A3B8">Sent by PGPass</p>
  </div>`;
}

export function rentReceiptEmail(params: {
  tenantName: string;
  pgName: string;
  amountRupees: number;
  receiptNumber: number;
  period: string;
}): { subject: string; html: string } {
  const receiptNo = `REC-${String(params.receiptNumber).padStart(5, '0')}`;
  return {
    subject: `Rent receipt ${receiptNo} · ${params.pgName}`,
    html: wrap(
      'Payment received',
      `<p>Hi ${params.tenantName},</p>
       <p>Your rent of <strong>₹${params.amountRupees.toLocaleString('en-IN')}</strong> for ${params.period} at ${params.pgName} has been confirmed.</p>
       <p>Receipt number: <strong>${receiptNo}</strong></p>`
    ),
  };
}

export function subscriptionApprovedEmail(params: {
  plan: string;
}): { subject: string; html: string } {
  return {
    subject: 'Your PGPass plan upgrade is active',
    html: wrap(
      'Upgrade approved',
      `<p>Your <strong>${params.plan}</strong> plan upgrade has been approved and your new limits are now active.</p>`
    ),
  };
}
