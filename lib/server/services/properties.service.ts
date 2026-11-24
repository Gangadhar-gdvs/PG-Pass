import 'server-only';
import { adminDb } from '../firebase-admin';
import { AppError } from '../api/withErrorHandler';
import { Property } from '@/types';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Multi-property support.
 *
 * Backward-compatibility convention: an owner's PRIMARY property has
 * `id === ownerId`. Existing single-PG data (which carries no propertyId) is
 * therefore implicitly owned by the primary property, and the primary property
 * document is materialized lazily from the legacy Owner fields — no backfill.
 */
export class PropertiesService {
  private propertyFromOwner(ownerId: string, owner: any): Property {
    return {
      id: ownerId,
      ownerId,
      isPrimary: true,
      pgName: owner.pgName || 'My PG',
      pgAddress: owner.pgAddress || owner.address || '',
      city: owner.city,
      area: owner.area,
      isListed: owner.isListed,
      pgCategory: owner.pgCategory,
      foodPlan: owner.foodPlan,
      foodCuisine: owner.foodCuisine,
      totalFloors: owner.totalFloors,
      roomsPerFloor: owner.roomsPerFloor,
      bedsPerRoom: owner.bedsPerRoom,
      monthlyRent: owner.monthlyRent,
      rentDueDay: owner.rentDueDay,
      lateFeePerDayPaise: owner.lateFeePerDayPaise,
      lateFeeGraceDays: owner.lateFeeGraceDays,
      pgAmenities: owner.pgAmenities,
      nextReceiptSeq: owner.nextReceiptSeq ?? 0,
    };
  }

  /**
   * Lists an owner's properties. If no stored primary-property doc exists yet,
   * returns a virtual primary materialized from the Owner profile (and persists
   * it so future reads are stored). Non-primary properties live only here.
   */
  async listProperties(ownerId: string): Promise<Property[]> {
    const snap = await adminDb
      .collection('properties')
      .where('ownerId', '==', ownerId)
      .limit(50)
      .get();

    const stored = snap.docs.map((d) => ({ ...d.data(), id: d.id } as Property));
    const hasPrimary = stored.some((p) => p.id === ownerId);

    if (!hasPrimary) {
      const ownerDoc = await adminDb.collection('owners').doc(ownerId).get();
      if (ownerDoc.exists) {
        const primary = this.propertyFromOwner(ownerId, ownerDoc.data());
        // Persist lazily so subsequent reads are consistent.
        await adminDb
          .collection('properties')
          .doc(ownerId)
          .set({ ...primary, createdAt: Timestamp.now(), updatedAt: Timestamp.now() }, { merge: true });
        stored.unshift(primary);
      }
    }

    // Primary first, then by name.
    return stored.sort((a, b) => {
      if (a.id === ownerId) return -1;
      if (b.id === ownerId) return 1;
      return (a.pgName || '').localeCompare(b.pgName || '');
    });
  }

  async getProperty(ownerId: string, propertyId: string): Promise<Property> {
    // The primary property may not be stored yet — materialize if needed.
    if (propertyId === ownerId) {
      const list = await this.listProperties(ownerId);
      const primary = list.find((p) => p.id === ownerId);
      if (primary) return primary;
    }
    const doc = await adminDb.collection('properties').doc(propertyId).get();
    if (!doc.exists) throw new AppError(404, 'Property not found');
    const data = doc.data() as Property;
    if (data.ownerId !== ownerId) throw new AppError(403, 'Unauthorized property access');
    return { ...data, id: doc.id };
  }

  async createProperty(
    ownerId: string,
    input: {
      pgName: string;
      pgAddress?: string;
      pgCategory?: Property['pgCategory'];
      monthlyRent?: number;
      rentDueDay?: number;
    }
  ): Promise<Property> {
    if (!input.pgName || input.pgName.trim().length < 2) {
      throw new AppError(400, 'Property name is required');
    }
    // Ensure the primary exists first (keeps the list consistent).
    await this.listProperties(ownerId);

    const ref = adminDb.collection('properties').doc();
    const now = Timestamp.now();
    const property: Property = {
      id: ref.id,
      ownerId,
      isPrimary: false,
      pgName: input.pgName.trim(),
      pgAddress: input.pgAddress?.trim() || '',
      pgCategory: input.pgCategory,
      monthlyRent: input.monthlyRent,
      rentDueDay: input.rentDueDay,
      nextReceiptSeq: 0,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(property);
    return property;
  }
}

export const propertiesService = new PropertiesService();
