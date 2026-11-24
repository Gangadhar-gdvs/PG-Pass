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
      panNumber?: string;
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
        panNumber: data.panNumber?.trim() || '',
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

    // Update existing profile (immutable fields: plan, accountStatus, limits, nextReceiptSeq)
    const updateData: Partial<Owner> = {
      name: data.name.trim(),
      phone: data.phone.trim(),
      pgName: data.pgName.trim(),
      pgAddress: data.address.trim(),
      address: data.address.trim(),
      upiId: data.upiId.trim().toLowerCase(),
      upiMerchantName: data.upiMerchantName?.trim() || data.name.trim(),
      panNumber: data.panNumber?.trim() || '',
      ...(data.pgCategory ? { pgCategory: data.pgCategory } : {}),
      ...(data.foodPlan ? { foodPlan: data.foodPlan } : {}),
      ...(data.foodCuisine ? { foodCuisine: data.foodCuisine } : {}),
      ...(data.noticePeriodDays ? { noticePeriodDays: data.noticePeriodDays } : {}),
      ...(data.city !== undefined ? { city: data.city.trim() } : {}),
      ...(data.area !== undefined ? { area: data.area.trim() } : {}),
      ...(data.isListed !== undefined ? { isListed: data.isListed } : {}),
      ...(data.rentDueDay !== undefined ? { rentDueDay: data.rentDueDay } : {}),
      ...(data.lateFeePerDayPaise !== undefined ? { lateFeePerDayPaise: data.lateFeePerDayPaise } : {}),
      ...(data.lateFeeGraceDays !== undefined ? { lateFeeGraceDays: data.lateFeeGraceDays } : {}),
      ...(data.pgAmenities ? { pgAmenities: data.pgAmenities } : {}),
      ...(data.totalFloors ? { totalFloors: data.totalFloors } : {}),
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
