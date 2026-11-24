import 'server-only';
import { env } from '@/lib/env';
import { logger } from '../monitoring/logger';

/**
 * Transactional SMS sender.
 *
 * Provider-agnostic: posts to a generic HTTP SMS endpoint (`SMS_API_URL`) with a
 * bearer key. **No-op when unconfigured**, so the app stays zero-cost/card-free
 * by default and reminders fall back to the free "open WhatsApp" client flow.
 *
 * Best-effort: failures are logged, never thrown into business logic.
 * Adapt `buildPayload` to your provider (Fast2SMS, MSG91, Twilio, …) when you
 * add a key — the default shape is the common `{ to, message, sender }`.
 */
export class SmsService {
  get isConfigured(): boolean {
    return Boolean(env.SMS_API_URL && env.SMS_API_KEY);
  }

  async send(toPhone: string, message: string): Promise<boolean> {
    if (!this.isConfigured) return false;
    const phone = (toPhone || '').replace(/\D/g, '');
    if (phone.length < 10) return false;

    try {
      const res = await fetch(env.SMS_API_URL!, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.SMS_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: phone.slice(-10),
          message: message.slice(0, 480),
          sender: env.SMS_SENDER_ID || 'PGPASS',
        }),
      });
      if (!res.ok) {
        logger.warn('sms.send.failed', { status: res.status });
        return false;
      }
      return true;
    } catch (err) {
      logger.warn('sms.send.error', { error: (err as Error).message });
      return false;
    }
  }
}

export const smsService = new SmsService();
