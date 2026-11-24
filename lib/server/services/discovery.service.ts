import 'server-only';
import { adminDb } from '../firebase-admin';
import { AppError } from '../api/withErrorHandler';
import { JoinRequest } from '@/types';
import { recordEvent } from './systemLogs.service';
import { Timestamp } from 'firebase-admin/firestore';

export interface PublicListing {
  propertyId: string;
  ownerId: string;
  pgName: string;
  city?: string;
  area?: string;
  pgCategory?: string;
  foodPlan?: string;
  monthlyRent?: number; // indicative base rent
}

/** Only public-safe fields — never owner PII, UPI, PAN, etc. */
function toListing(id: string, data: any): PublicListing {
  return {
    propertyId: id,
    ownerId: data.ownerId,
    pgName: data.pgName || 'PG',
    city: data.city,
    area: data.area,
    pgCategory: data.pgCategory,
    foodPlan: data.foodPlan,
    monthlyRent: data.monthlyRent,
  };
}

export class DiscoveryService {
  /**
   * Public PG search over listed properties. `city` narrows server-side (indexed);
   * `q` does a light client-style name/area contains-match on the page.
   */
  async search(params: { city?: string; q?: string; limit?: number }): Promise<PublicListing[]> {
    const lim = Math.min(params.limit || 50, 100);
    let query = adminDb.collection('properties').where('isListed', '==', true) as any;
    if (params.city) query = query.where('city', '==', params.city.trim());
    query = query.limit(lim);

    const snap = await query.get();
    let listings = snap.docs.map((d: any) => toListing(d.id, d.data()));

    const q = params.q?.trim().toLowerCase();
    if (q) {
      listings = listings.filter(
        (l: PublicListing) =>
          l.pgName.toLowerCase().includes(q) ||
          (l.area || '').toLowerCase().includes(q) ||
          (l.city || '').toLowerCase().includes(q)
      );
    }
    return listings;
  }

  async getListing(propertyId: string): Promise<PublicListing> {
    const doc = await adminDb.collection('properties').doc(propertyId).get();
    if (!doc.exists || !doc.data()?.isListed) {
      throw new AppError(404, 'PG not found or not listed');
    }
    return toListing(doc.id, doc.data());
  }

  /** A resident requests to join a listed PG. Deduped per resident+property. */
  async requestJoin(params: {
    propertyId: string;
    residentId: string;
    residentName: string;
    residentPhone: string;
    message?: string;
  }): Promise<JoinRequest> {
    const listing = await this.getListing(params.propertyId);

    const dedupeId = `${params.propertyId}_${params.residentId}`;
    const ref = adminDb.collection('join_requests').doc(dedupeId);
    const existing = await ref.get();
    if (existing.exists && existing.data()?.status === 'pending') {
      throw new AppError(409, 'You already have a pending request for this PG');
    }

    const now = Timestamp.now();
    const joinReq: JoinRequest = {
      id: dedupeId,
      propertyId: params.propertyId,
      ownerId: listing.ownerId,
      residentId: params.residentId,
      residentName: params.residentName,
      residentPhone: params.residentPhone,
      message: params.message?.trim().slice(0, 300),
      status: 'pending',
      createdAt: now,
    };
    await ref.set(joinReq);
    return joinReq;
  }

  /** Owner lists pending join requests for their PGs. */
  async listForOwner(ownerId: string, limit = 50): Promise<JoinRequest[]> {
    const snap = await adminDb
      .collection('join_requests')
      .where('ownerId', '==', ownerId)
      .where('status', '==', 'pending')
      .orderBy('createdAt', 'desc')
      .limit(Math.min(limit, 100))
      .get();
    return snap.docs.map((d) => ({ ...d.data(), id: d.id } as JoinRequest));
  }

  async review(
    requestId: string,
    ownerId: string,
    action: 'approved' | 'declined',
    reviewerUid: string
  ): Promise<void> {
    const ref = adminDb.collection('join_requests').doc(requestId);
    const doc = await ref.get();
    if (!doc.exists) throw new AppError(404, 'Request not found');
    if ((doc.data() as JoinRequest).ownerId !== ownerId) throw new AppError(403, 'Unauthorized');
    const req = doc.data() as JoinRequest;
    await ref.update({ status: action, reviewedAt: Timestamp.now(), reviewedBy: reviewerUid });

    await recordEvent({
      category: 'discovery',
      message: `Join request ${action} for ${req.residentName} (${req.residentPhone})`,
      ownerId,
      actorUid: reviewerUid,
      targetId: requestId,
    });
    // Approval just signals the owner to create the tenancy (phone links it to
    // the resident automatically). No tenant doc is auto-created here.
  }
}

export const discoveryService = new DiscoveryService();
