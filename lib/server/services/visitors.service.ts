import 'server-only';
import { adminDb } from '../firebase-admin';
import { AppError } from '../api/withErrorHandler';
import { Visitor } from '@/types';
import { MAX_LIST_LIMIT } from '@/lib/constants/limits';
import { normalizePhone } from '@/lib/utils';
import { Timestamp } from 'firebase-admin/firestore';

export class VisitorsService {
  /** Log a visitor check-in. Minimal data by design (name required, rest optional). */
  async checkIn(params: {
    ownerId: string;
    name: string;
    purpose?: string;
    visitingResident?: string;
    roomNumber?: string;
    phone?: string;
    recordedBy: string;
  }): Promise<Visitor> {
    const name = params.name.trim().slice(0, 80);
    if (name.length < 2) throw new AppError(400, 'Please enter the visitor name');
    const phone = normalizePhone(params.phone) || undefined;

    const ref = adminDb.collection('visitors').doc();
    const now = Timestamp.now();
    const visitor: Visitor = {
      id: ref.id,
      ownerId: params.ownerId,
      propertyId: params.ownerId,
      name,
      purpose: params.purpose?.trim().slice(0, 120) || undefined,
      visitingResident: params.visitingResident?.trim().slice(0, 80) || undefined,
      roomNumber: params.roomNumber?.trim() || undefined,
      phone,
      checkInAt: now,
      checkOutAt: null,
      status: 'in',
      recordedBy: params.recordedBy,
      createdAt: now,
    };
    await ref.set(visitor);
    return visitor;
  }

  /** Mark a visitor checked out. */
  async checkOut(visitorId: string, ownerId: string): Promise<Visitor> {
    const ref = adminDb.collection('visitors').doc(visitorId);
    const snap = await ref.get();
    if (!snap.exists) throw new AppError(404, 'Visitor not found');
    const data = snap.data() as Visitor;
    if (data.ownerId !== ownerId) throw new AppError(403, 'Unauthorized');
    if (data.status === 'out') return { ...data, id: visitorId };
    const now = Timestamp.now();
    await ref.update({ status: 'out', checkOutAt: now });
    return { ...data, id: visitorId, status: 'out', checkOutAt: now };
  }

  /** Recent visitors, newest first ("in" first for quick checkout). */
  async list(ownerId: string, limitCount = 100): Promise<Visitor[]> {
    const safeLimit = Math.min(limitCount, MAX_LIST_LIMIT);
    const snap = await adminDb
      .collection('visitors')
      .where('ownerId', '==', ownerId)
      .orderBy('checkInAt', 'desc')
      .limit(safeLimit)
      .get();
    return snap.docs
      .map((d) => ({ ...d.data(), id: d.id } as Visitor))
      .sort((a, b) => Number(a.status === 'out') - Number(b.status === 'out'));
  }
}

export const visitorsService = new VisitorsService();
