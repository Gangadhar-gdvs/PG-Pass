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
      updatedAt: Timestamp.now(),
    };

    await docRef.update(updateData as any);
    const updated = await docRef.get();
    return updated.data() as Owner;
  }
}

export const ownersService = new OwnersService();
