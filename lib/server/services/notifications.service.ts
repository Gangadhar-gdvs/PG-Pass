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
}

export const notificationsService = new NotificationsService();
