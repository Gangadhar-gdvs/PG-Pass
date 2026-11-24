import 'server-only';
import { adminDb } from '../firebase-admin';
import { Owner } from '@/types';
import { AppError } from '../api/withErrorHandler';
import { PLAN_LIMITS, FREE_MAX_BEDS, FREE_MAX_PHOTOS, FREE_MAX_STAFF } from '@/lib/constants/limits';
import { PLAN_TIER, ACCOUNT_STATUS } from '@/lib/constants/status';
import { Timestamp } from 'firebase-admin/firestore';

export class OwnersService {
  async getProfile(ownerId: string): Promise<Owner | null> {
    const doc = await adminDb.collection('owners').doc(ownerId).get();
    if (!doc.exists) return null;
    return doc.data() as Owner;
  }

  async upsertProfile(
    ownerId: string,
    data: {
      name: string;
      phone: string;
      pgName: string;
      address: string;
      upiId: string;
      upiMerchantName?: string;
      pgCategory?: 'gents' | 'ladies' | 'coliving';
      foodPlan?: '3_meals' | '2_meals' | 'no_food';
      foodCuisine?: 'both' | 'south' | 'north';
      noticePeriodDays?: number;
      city?: string;
      area?: string;
      isListed?: boolean;
      rentDueDay?: number;
      lateFeePerDayPaise?: number;
      lateFeeGraceDays?: number;
      pgAmenities?: string[];
      totalFloors?: number;
    }
  ): Promise<Owner> {
    const docRef = adminDb.collection('owners').doc(ownerId);
    const existing = await docRef.get();

    if (!existing.exists) {
      // First time onboarding: initialize mandatory Rev 3 production fields
      const newOwner: Owner = {
        id: ownerId,
        name: data.name.trim(),
        phone: data.phone.trim(),
        pgName: data.pgName.trim(),
        pgAddress: data.address.trim(),
        address: data.address.trim(),
        upiId: data.upiId.trim().toLowerCase(),
        upiMerchantName: data.upiMerchantName?.trim() || data.name.trim(),
        pgCategory: data.pgCategory,
        foodPlan: data.foodPlan,
        foodCuisine: data.foodCuisine,
        noticePeriodDays: data.noticePeriodDays,
        pgAmenities: data.pgAmenities,
        totalFloors: data.totalFloors,
        accountStatus: ACCOUNT_STATUS.ACTIVE,
        plan: PLAN_TIER.FREE,
        maxBeds: FREE_MAX_BEDS,
        maxTenants: FREE_MAX_BEDS,
        maxPhotos: FREE_MAX_PHOTOS,
        maxStaff: FREE_MAX_STAFF,
        nextReceiptSeq: 0, // Mandatory integer sequence initialized to 0
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      };

      await docRef.set(newOwner);
      return newOwner;
    }

    // Update existing profile (immutable fields: plan, accountStatus, limits, nextReceiptSeq).
    // Guard every .trim() against undefined — the admin act-as-owner path may
    // merge a partial profile where a never-set field is undefined.
    // Service-layer bounds (authoritative — holds even if a caller skips Zod):
    // cap string lengths and clamp numeric ranges so bad data can't reach Firestore.
    const cap = (s: string | undefined, n: number) => (s || '').trim().slice(0, n);
    const clampInt = (v: any, lo: number, hi: number, fallback: number) => {
      const n = Math.round(Number(v));
      return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
    };
    const updateData: Partial<Owner> = {
      name: cap(data.name, 80),
      phone: cap(data.phone, 15),
      pgName: cap(data.pgName, 80),
      pgAddress: cap(data.address, 200),
      address: cap(data.address, 200),
      upiId: cap(data.upiId, 120).toLowerCase(),
      upiMerchantName: cap(data.upiMerchantName, 80) || cap(data.name, 80),
      ...(data.pgCategory ? { pgCategory: data.pgCategory } : {}),
      ...(data.foodPlan ? { foodPlan: data.foodPlan } : {}),
      ...(data.foodCuisine ? { foodCuisine: data.foodCuisine } : {}),
      ...(data.noticePeriodDays !== undefined
        ? { noticePeriodDays: clampInt(data.noticePeriodDays, 0, 365, 30) }
        : {}),
      ...(data.city !== undefined ? { city: cap(data.city, 60) } : {}),
      ...(data.area !== undefined ? { area: cap(data.area, 80) } : {}),
      ...(data.isListed !== undefined ? { isListed: !!data.isListed } : {}),
      ...(data.rentDueDay !== undefined ? { rentDueDay: clampInt(data.rentDueDay, 1, 28, 5) } : {}),
      ...(data.lateFeePerDayPaise !== undefined
        ? { lateFeePerDayPaise: clampInt(data.lateFeePerDayPaise, 0, 10_000_00, 0) }
        : {}),
      ...(data.lateFeeGraceDays !== undefined
        ? { lateFeeGraceDays: clampInt(data.lateFeeGraceDays, 0, 28, 0) }
        : {}),
      ...(data.pgAmenities ? { pgAmenities: data.pgAmenities } : {}),
      ...(data.totalFloors !== undefined ? { totalFloors: clampInt(data.totalFloors, 1, 50, 1) } : {}),
      updatedAt: Timestamp.now(),
    };

    await docRef.update(updateData as any);

    // Mirror public-listing fields onto the PRIMARY property doc (id == ownerId)
    // so PG discovery (which reads `properties`) stays in sync even if the owner
    // never opened the properties UI.
    if (
      data.pgName !== undefined ||
      data.city !== undefined ||
      data.area !== undefined ||
      data.isListed !== undefined ||
      data.address !== undefined ||
      data.pgCategory !== undefined
    ) {
      await adminDb
        .collection('properties')
        .doc(ownerId)
        .set(
          {
            id: ownerId,
            ownerId,
            isPrimary: true,
            pgName: data.pgName?.trim(),
            pgAddress: data.address?.trim(),
            ...(data.city !== undefined ? { city: data.city.trim() } : {}),
            ...(data.area !== undefined ? { area: data.area.trim() } : {}),
            ...(data.isListed !== undefined ? { isListed: data.isListed } : {}),
            ...(data.pgCategory ? { pgCategory: data.pgCategory } : {}),
            updatedAt: Timestamp.now(),
          },
          { merge: true }
        );
    }

    return {
      ...(existing.data() as Owner),
      ...updateData,
    } as Owner;
  }
}

export const ownersService = new OwnersService();
