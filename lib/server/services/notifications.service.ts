import 'server-only';
import { adminDb } from '../firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export interface NotificationPayload {
  type: 'signup' | 'subscription' | 'support_flag' | 'lockout' | 'quota';
  severity: 'low' | 'medium' | 'high';
  message: string;
  relatedOwnerId?: string;
  relatedTenantId?: string;
}

export interface OwnerNotificationPayload {
  ownerId: string;
  type: 'subscription' | 'payment' | 'moveout' | 'system';
  message: string;
}

export class NotificationsService {
  async notify(payload: NotificationPayload): Promise<void> {
    const docRef = adminDb.collection('admin_notifications').doc();
    await docRef.set({
      id: docRef.id,
      ...payload,
      status: 'unread',
      resolvedBy: null,
      resolvedAt: null,
      createdAt: Timestamp.now(),
    });
  }

  /**
   * Owner-facing notification (e.g. "your plan upgrade was approved"), stored in
   * `owner_notifications` and surfaced in the owner console.
   */
  async notifyOwner(payload: OwnerNotificationPayload): Promise<void> {
    const docRef = adminDb.collection('owner_notifications').doc();
    await docRef.set({
      id: docRef.id,
      ownerId: payload.ownerId,
      type: payload.type,
      message: payload.message,
      status: 'unread',
      createdAt: Timestamp.now(),
    });
  }
}

export const notificationsService = new NotificationsService();
