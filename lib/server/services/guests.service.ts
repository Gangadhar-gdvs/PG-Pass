import 'server-only';
import { adminDb } from '../firebase-admin';
import { AppError } from '../api/withErrorHandler';
import { GuestStay, Bed } from '@/types';
import { BED_STATUS } from '@/lib/constants/status';
import { Timestamp } from 'firebase-admin/firestore';

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = Date.parse(`${checkIn}T00:00:00Z`);
  const b = Date.parse(`${checkOut}T00:00:00Z`);
  if (isNaN(a) || isNaN(b)) return 1;
  return Math.max(1, Math.round((b - a) / (24 * 60 * 60 * 1000)));
}

export interface CheckInGuestInput {
  bedId: string;
  name: string;
  phone?: string;
  checkInDate: string;
  checkOutDate: string;
  billingMode: 'per_night' | 'flat';
  nightlyRatePaise?: number;
  flatTotalPaise?: number;
  amountPaidPaise?: number;
  idProofType?: string;
  notes?: string;
}

export class GuestsService {
  /**
   * Check in a short-stay guest. Atomic: asserts the bed is vacant, marks it
   * `guest`, and creates the stay with an up-front total. Pricing is either
   * per-night (rate × nights) or a flat amount.
   */
  async checkIn(ownerId: string, recordedBy: string, input: CheckInGuestInput): Promise<GuestStay> {
    if (!input.name || input.name.trim().length < 2) throw new AppError(400, 'Guest name is required');
    const nights = nightsBetween(input.checkInDate, input.checkOutDate);

    let totalAmountPaise: number;
    let nightlyRatePaise: number | undefined;
    if (input.billingMode === 'per_night') {
      nightlyRatePaise = Math.round(input.nightlyRatePaise || 0);
      if (nightlyRatePaise <= 0) throw new AppError(400, 'Enter a valid per-night rate');
      totalAmountPaise = nightlyRatePaise * nights;
    } else {
      totalAmountPaise = Math.round(input.flatTotalPaise || 0);
      if (totalAmountPaise <= 0) throw new AppError(400, 'Enter a valid total amount');
    }

    const bedRef = adminDb.collection('beds').doc(input.bedId);
    const stayRef = adminDb.collection('guest_stays').doc();
    const now = Timestamp.now();
    let stay: GuestStay;

    await adminDb.runTransaction(async (tx) => {
      const bedDoc = await tx.get(bedRef);
      if (!bedDoc.exists) throw new AppError(404, 'Selected bed not found');
      const bed = bedDoc.data() as Bed;
      if (bed.ownerId !== ownerId) throw new AppError(403, 'Unauthorized bed');
      if (bed.status !== BED_STATUS.VACANT) {
        throw new AppError(409, `Bed ${bed.roomNumber}-${bed.bedLabel} is not available.`);
      }

      stay = {
        id: stayRef.id,
        ownerId,
        propertyId: bed.propertyId || ownerId,
        bedId: input.bedId,
        bedLabel: bed.bedLabel,
        roomNumber: bed.roomNumber,
        name: input.name.trim(),
        phone: input.phone?.replace(/\D/g, '').slice(-10) || undefined,
        checkInDate: input.checkInDate,
        checkOutDate: input.checkOutDate,
        nights,
        billingMode: input.billingMode,
        nightlyRatePaise,
        totalAmountPaise,
        amountPaidPaise: Math.round(input.amountPaidPaise ?? totalAmountPaise),
        idProofType: input.idProofType,
        notes: input.notes?.trim().slice(0, 300) || undefined,
        status: 'active',
        recordedBy,
        createdAt: now,
      };
      tx.set(stayRef, stay);

      // Mark the bed as guest-occupied (shown distinctly, frees on checkout).
      tx.update(bedRef, {
        status: BED_STATUS.GUEST,
        tenantId: null,
        tenantName: `Guest · ${input.name.trim()}`,
        tenantPhone: stay.phone || null,
        updatedAt: now,
      });
    });

    return stay!;
  }

  async list(ownerId: string, status?: 'active' | 'completed', limitCount = 50): Promise<GuestStay[]> {
    let q: any = adminDb.collection('guest_stays').where('ownerId', '==', ownerId);
    if (status) q = q.where('status', '==', status);
    q = q.orderBy('createdAt', 'desc').limit(Math.min(limitCount, 100));
    const snap = await q.get();
    return snap.docs.map((d: any) => ({ ...d.data(), id: d.id } as GuestStay));
  }

  /** Check out a guest: free the bed, mark the stay completed. */
  async checkOut(ownerId: string, stayId: string): Promise<void> {
    const stayRef = adminDb.collection('guest_stays').doc(stayId);
    const now = Timestamp.now();

    await adminDb.runTransaction(async (tx) => {
      const stayDoc = await tx.get(stayRef);
      if (!stayDoc.exists) throw new AppError(404, 'Guest stay not found');
      const stay = stayDoc.data() as GuestStay;
      if (stay.ownerId !== ownerId) throw new AppError(403, 'Unauthorized');
      if (stay.status === 'completed') throw new AppError(400, 'Guest already checked out');

      const bedRef = adminDb.collection('beds').doc(stay.bedId);
      const bedDoc = await tx.get(bedRef);
      // Only free the bed if it's still held by this guest (avoid clobbering a
      // bed that was reassigned).
      if (bedDoc.exists && bedDoc.data()?.status === BED_STATUS.GUEST) {
        tx.update(bedRef, {
          status: BED_STATUS.VACANT,
          tenantId: null,
          tenantName: null,
          tenantPhone: null,
          updatedAt: now,
        });
      }

      tx.update(stayRef, { status: 'completed', checkedOutAt: now });
    });
  }
}

export const guestsService = new GuestsService();
