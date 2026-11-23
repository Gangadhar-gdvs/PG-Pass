import 'server-only';
import { adminDb } from '../firebase-admin';
import { Bed } from '@/types';
import { AppError } from '../api/withErrorHandler';
import { BED_STATUS } from '@/lib/constants/status';
import { MAX_LIST_LIMIT } from '@/lib/constants/limits';
import { Timestamp } from 'firebase-admin/firestore';

export class BedsService {
  async listBeds(ownerId: string, limitCount = 50, startAfterId?: string): Promise<Bed[]> {
    const safeLimit = Math.min(limitCount, MAX_LIST_LIMIT);
    let q = adminDb
      .collection('beds')
      .where('ownerId', '==', ownerId)
      .orderBy('roomNumber', 'asc')
      .limit(safeLimit);

    if (startAfterId) {
      const cursorDoc = await adminDb.collection('beds').doc(startAfterId).get();
      if (cursorDoc.exists) {
        q = q.startAfter(cursorDoc);
      }
    }

    const snap = await q.get();
    return snap.docs.map((d) => ({ ...d.data(), id: d.id } as Bed));
  }

  async getBed(bedId: string, ownerId: string): Promise<Bed> {
    const doc = await adminDb.collection('beds').doc(bedId).get();
    if (!doc.exists) {
      throw new AppError(404, 'Bed not found');
    }
    const data = doc.data() as Bed;
    if (data.ownerId !== ownerId) {
      throw new AppError(403, 'Unauthorized bed access');
    }
    return { ...data, id: doc.id };
  }

  async createBed(
    ownerId: string,
    data: {
      roomNumber: string;
      bedLabel: string;
      rentAmountPaise: number;
      floor?: number;
    }
  ): Promise<Bed> {
    // 1. Quota check
    const ownerDoc = await adminDb.collection('owners').doc(ownerId).get();
    if (!ownerDoc.exists) {
      throw new AppError(404, 'Owner profile not found. Please complete setup.');
    }
    const maxBeds = ownerDoc.data()?.maxBeds ?? 20;

    const countSnap = await adminDb
      .collection('beds')
      .where('ownerId', '==', ownerId)
      .count()
      .get();

    if (countSnap.data().count >= maxBeds) {
      throw new AppError(
        403,
        `Plan bed limit reached (${maxBeds} beds). Please upgrade your plan in Billing.`
      );
    }

    const bedId = `${ownerId}_${data.roomNumber}_${data.bedLabel}`.replace(/[\s/]/g, '-');
    const bedRef = adminDb.collection('beds').doc(bedId);

    const existing = await bedRef.get();
    if (existing.exists) {
      throw new AppError(409, `Bed ${data.roomNumber}-${data.bedLabel} already exists`);
    }

    const newBed: Bed = {
      id: bedId,
      ownerId,
      roomNumber: data.roomNumber.trim(),
      bedLabel: data.bedLabel.trim(),
      rentAmountPaise: data.rentAmountPaise,
      monthlyRent: Math.round(data.rentAmountPaise / 100),
      floor: data.floor ?? 1,
      status: BED_STATUS.VACANT,
      tenantId: undefined,
      tenantName: undefined,
      tenantPhone: undefined,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    await bedRef.set(newBed);
    return newBed;
  }

  async updateBed(
    bedId: string,
    ownerId: string,
    data: Partial<Pick<Bed, 'roomNumber' | 'bedLabel' | 'rentAmountPaise' | 'status'>>
  ): Promise<Bed> {
    const bed = await this.getBed(bedId, ownerId);

    if (bed.status === BED_STATUS.OCCUPIED && data.status === BED_STATUS.VACANT) {
      throw new AppError(400, 'Cannot mark an occupied bed as vacant directly. Move out tenant first.');
    }

    const updatePayload: any = {
      ...data,
      updatedAt: Timestamp.now(),
    };

    await adminDb.collection('beds').doc(bedId).update(updatePayload);
    return this.getBed(bedId, ownerId);
  }

  async deleteBed(bedId: string, ownerId: string): Promise<void> {
    const bed = await this.getBed(bedId, ownerId);
    if (bed.status === BED_STATUS.OCCUPIED || bed.tenantId) {
      throw new AppError(400, 'Cannot delete an occupied bed. Vacate the resident first.');
    }
    await adminDb.collection('beds').doc(bedId).delete();
  }
}

export const bedsService = new BedsService();
