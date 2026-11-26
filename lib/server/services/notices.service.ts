import 'server-only';
import { adminDb } from '../firebase-admin';
import { AppError } from '../api/withErrorHandler';
import { Notice, NoticeAudience } from '@/types';
import { MAX_LIST_LIMIT } from '@/lib/constants/limits';
import { recordEvent } from './systemLogs.service';
import { Timestamp } from 'firebase-admin/firestore';

const AUDIENCES: NoticeAudience[] = ['all', 'residents', 'staff'];

export class NoticesService {
  /** Owner (or permitted staff) publishes a notice. */
  async create(params: {
    ownerId: string;
    propertyId?: string;
    title: string;
    body: string;
    audience: string;
    roomNumber?: string;
    pinned?: boolean;
    expiresAt?: string | null; // ISO date; null = no expiry
    createdBy: string;
    createdByName?: string;
  }): Promise<Notice> {
    const title = params.title.trim().slice(0, 120);
    const body = params.body.trim().slice(0, 2000);
    if (title.length < 2) throw new AppError(400, 'Please enter a notice title');
    if (body.length < 2) throw new AppError(400, 'Please enter the notice message');
    const audience = (AUDIENCES as string[]).includes(params.audience)
      ? (params.audience as NoticeAudience)
      : 'all';

    const ref = adminDb.collection('notices').doc();
    const now = Timestamp.now();
    const expiresAt =
      params.expiresAt && !isNaN(Date.parse(params.expiresAt))
        ? Timestamp.fromDate(new Date(params.expiresAt))
        : null;

    const notice: Notice = {
      id: ref.id,
      ownerId: params.ownerId,
      propertyId: params.propertyId || params.ownerId,
      title,
      body,
      audience,
      roomNumber: params.roomNumber?.trim() || undefined,
      pinned: params.pinned || false,
      publishedAt: now,
      expiresAt,
      createdBy: params.createdBy,
      createdByName: params.createdByName,
      readBy: [],
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(notice);
    await recordEvent({
      category: 'account',
      level: 'info',
      message: `Notice published: "${title}" (${audience}) by ${params.createdBy}`,
      ownerId: params.ownerId,
      targetId: ref.id,
    });
    return notice;
  }

  /** Owner's own notices (active + optionally expired), newest first. */
  async listForOwner(ownerId: string, limitCount = 50): Promise<Notice[]> {
    const safeLimit = Math.min(limitCount, MAX_LIST_LIMIT);
    const snap = await adminDb
      .collection('notices')
      .where('ownerId', '==', ownerId)
      .orderBy('createdAt', 'desc')
      .limit(safeLimit)
      .get();
    return snap.docs
      .map((d) => ({ ...d.data(), id: d.id } as Notice))
      .filter((n) => !n.deletedAt);
  }

  /**
   * Notices visible to a given viewer. `viewerAudience` is 'residents' or
   * 'staff'. Residents also see room-scoped notices only when the room matches.
   * Expired notices are filtered out.
   */
  async listForViewer(
    ownerId: string,
    viewerAudience: 'residents' | 'staff',
    opts: { roomNumber?: string } = {},
    limitCount = 50
  ): Promise<Notice[]> {
    const safeLimit = Math.min(limitCount, MAX_LIST_LIMIT);
    const snap = await adminDb
      .collection('notices')
      .where('ownerId', '==', ownerId)
      .orderBy('createdAt', 'desc')
      .limit(safeLimit)
      .get();
    const nowMs = Date.now();
    return snap.docs
      .map((d) => ({ ...d.data(), id: d.id } as Notice))
      .filter((n) => {
        if (n.deletedAt) return false;
        if (n.audience !== 'all' && n.audience !== viewerAudience) return false;
        // Room scope (residents only): a room-scoped notice is hidden unless it
        // matches the viewer's room.
        if (n.roomNumber && viewerAudience === 'residents' && n.roomNumber !== opts.roomNumber) return false;
        // Expiry
        const exp = (n.expiresAt as { toMillis?: () => number } | null)?.toMillis?.();
        if (exp && exp < nowMs) return false;
        return true;
      })
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned)); // pinned first
  }

  /** Mark a notice read by a viewer (idempotent). */
  async markRead(noticeId: string, ownerId: string, viewerId: string): Promise<void> {
    const ref = adminDb.collection('notices').doc(noticeId);
    const snap = await ref.get();
    if (!snap.exists) return;
    const data = snap.data() as Notice;
    if (data.ownerId !== ownerId) throw new AppError(403, 'Unauthorized');
    const readBy = new Set(data.readBy || []);
    if (readBy.has(viewerId)) return; // idempotent
    readBy.add(viewerId);
    await ref.update({ readBy: Array.from(readBy) });
  }

  /** Owner soft-deletes a notice. */
  async softDelete(noticeId: string, ownerId: string): Promise<void> {
    const ref = adminDb.collection('notices').doc(noticeId);
    const snap = await ref.get();
    if (!snap.exists) throw new AppError(404, 'Notice not found');
    if ((snap.data() as Notice).ownerId !== ownerId) throw new AppError(403, 'Unauthorized');
    await ref.update({ deletedAt: Timestamp.now(), updatedAt: Timestamp.now() });
  }
}

export const noticesService = new NoticesService();
