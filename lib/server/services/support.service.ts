import 'server-only';
import { adminDb } from '../firebase-admin';
import { AppError } from '../api/withErrorHandler';
import { SupportThread, SupportMessage } from '@/types';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

/**
 * Owner↔admin support chat. One thread per owner (`support_threads/{ownerId}`)
 * with a `messages` subcollection. Both parties watch the thread live via
 * Firestore onSnapshot (server push — NOT polling); writes go through here.
 */
export class SupportService {
  /**
   * Append a message and update the thread summary + unread counters atomically.
   * `sender` is 'owner' or 'admin'.
   */
  async sendMessage(
    ownerId: string,
    sender: 'owner' | 'admin',
    senderUid: string,
    text: string
  ): Promise<SupportMessage> {
    const body = (text || '').trim();
    if (body.length === 0) throw new AppError(400, 'Message cannot be empty');
    if (body.length > 2000) throw new AppError(400, 'Message is too long');

    const threadRef = adminDb.collection('support_threads').doc(ownerId);
    const msgRef = threadRef.collection('messages').doc();
    const now = Timestamp.now();

    // Materialize the thread header (owner name / pg name) the first time.
    let ownerName: string | undefined;
    let pgName: string | undefined;
    const threadSnap = await threadRef.get();
    if (!threadSnap.exists) {
      const ownerDoc = await adminDb.collection('owners').doc(ownerId).get();
      ownerName = ownerDoc.data()?.name;
      pgName = ownerDoc.data()?.pgName;
    }

    const message: SupportMessage = {
      id: msgRef.id,
      threadId: ownerId,
      sender,
      senderUid,
      text: body,
      createdAt: now,
    };

    const batch = adminDb.batch();
    batch.set(msgRef, message);
    batch.set(
      threadRef,
      {
        id: ownerId,
        ownerId,
        ...(ownerName ? { ownerName } : {}),
        ...(pgName ? { pgName } : {}),
        lastMessage: body.slice(0, 120),
        lastSender: sender,
        lastAt: now,
        // Increment the unread counter for the OTHER party.
        [sender === 'owner' ? 'unreadForAdmin' : 'unreadForOwner']: FieldValue.increment(1),
        [sender === 'owner' ? 'unreadForOwner' : 'unreadForAdmin']: 0,
        ...(threadSnap.exists ? {} : { createdAt: now }),
      },
      { merge: true }
    );
    await batch.commit();

    return message;
  }

  /** Admin: list support threads, most-recently-active first. */
  async listThreads(limit = 50): Promise<SupportThread[]> {
    const snap = await adminDb
      .collection('support_threads')
      .orderBy('lastAt', 'desc')
      .limit(Math.min(limit, 100))
      .get();
    return snap.docs.map((d) => ({ ...d.data(), id: d.id } as SupportThread));
  }

  /** Clear the unread counter for whichever side just opened the thread. */
  async markRead(ownerId: string, reader: 'owner' | 'admin'): Promise<void> {
    const field = reader === 'owner' ? 'unreadForOwner' : 'unreadForAdmin';
    const ref = adminDb.collection('support_threads').doc(ownerId);
    // Use update (not set/merge) so marking-read on a thread that doesn't exist
    // yet is a no-op instead of creating an empty thread in the admin list.
    await ref.update({ [field]: 0 }).catch(() => {});
  }
}

export const supportService = new SupportService();
