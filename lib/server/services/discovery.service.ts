import 'server-only';
import { adminDb } from '../firebase-admin';
import { AppError } from '../api/withErrorHandler';
import { JoinRequest, PropertyPhoto, Timestampish } from '@/types';
import { recordEvent } from './systemLogs.service';
import { tsToDate, tsToMillis } from '@/lib/utils';

interface PgReviewDoc {
  id: string;
  reviewerName?: string;
  reviewerRole?: string;
  rating: number;
  text?: string;
  updatedAt?: Timestampish;
}
import { Timestamp, Query, QueryDocumentSnapshot } from 'firebase-admin/firestore';

export interface PublicListing {
  propertyId: string;
  ownerId: string;
  pgName: string;
  city?: string;
  area?: string;
  pgCategory?: string;
  foodPlan?: string;
  monthlyRent?: number; // indicative base rent
  coverPhotoUrl?: string; // first gallery photo, for the search card
  ratingAvg?: number; // 0 when no reviews
  ratingCount?: number;
}

/** Average helper from a {count,sum} aggregate. */
function avgOf(agg: { count?: number; sum?: number } | undefined): {
  ratingAvg: number;
  ratingCount: number;
} {
  const count = agg?.count || 0;
  const sum = agg?.sum || 0;
  return { ratingAvg: count > 0 ? Math.round((sum / count) * 10) / 10 : 0, ratingCount: count };
}

/** Only public-safe fields — never owner PII, UPI, PAN, etc. */
function toListing(id: string, data: Record<string, unknown>): PublicListing {
  const d = data as {
    ownerId: string;
    pgName?: string;
    city?: string;
    area?: string;
    pgCategory?: string;
    foodPlan?: string;
    monthlyRent?: number;
    coverPhotoUrl?: string;
    reviewAgg?: { count?: number; sum?: number };
  };
  return {
    propertyId: id,
    ownerId: d.ownerId,
    pgName: d.pgName || 'PG',
    city: d.city,
    area: d.area,
    pgCategory: d.pgCategory,
    foodPlan: d.foodPlan,
    monthlyRent: d.monthlyRent,
    coverPhotoUrl: d.coverPhotoUrl || undefined, // denormalized on first photo upload
    ...avgOf(d.reviewAgg),
  };
}

export class DiscoveryService {
  /**
   * Public PG search over listed properties. `city` narrows server-side (indexed);
   * `q` does a light client-style name/area contains-match on the page.
   */
  async search(params: { city?: string; q?: string; limit?: number }): Promise<PublicListing[]> {
    const lim = Math.min(params.limit || 50, 100);
    let query: Query = adminDb.collection('properties').where('isListed', '==', true);
    if (params.city) query = query.where('city', '==', params.city.trim());
    query = query.limit(lim);

    const snap = await query.get();
    // Honor the admin per-PG `discovery` feature flag (fail-open unless set false).
    let listings = snap.docs
      .filter((d: QueryDocumentSnapshot) => {
        const features = d.data()?.features as { discovery?: boolean } | undefined;
        return features?.discovery !== false;
      })
      .map((d: QueryDocumentSnapshot) => toListing(d.id, d.data()));

    const q = params.q?.trim().toLowerCase();
    if (q) {
      listings = listings.filter(
        (l: PublicListing) =>
          l.pgName.toLowerCase().includes(q) ||
          (l.area || '').toLowerCase().includes(q) ||
          (l.city || '').toLowerCase().includes(q)
      );
    }

    // Cover photos come from the denormalized `coverPhotoUrl` on the property
    // doc (set on first photo upload) — no per-listing query. Only legacy
    // listings that predate denormalization fall back to a one-off lookup, and
    // that fallback is capped so a public search can't fan out unboundedly.
    const missing = listings.filter((l: PublicListing) => !l.coverPhotoUrl).slice(0, 10);
    await Promise.all(
      missing.map(async (l: PublicListing) => {
        const photoSnap = await adminDb
          .collection('property_photos')
          .where('propertyId', '==', l.propertyId)
          .limit(1)
          .get();
        if (!photoSnap.empty) l.coverPhotoUrl = photoSnap.docs[0].data().publicUrl;
      })
    );
    return listings;
  }

  async getListing(propertyId: string): Promise<PublicListing> {
    const doc = await adminDb.collection('properties').doc(propertyId).get();
    if (!doc.exists || !doc.data()?.isListed) {
      throw new AppError(404, 'PG not found or not listed');
    }
    return toListing(doc.id, doc.data()!);
  }

  /**
   * Full public PG page: listing + gallery photos + visible reviews + a public
   * contact (phone + address). Still never exposes UPI, email, or internal data.
   */
  async getListingDetail(propertyId: string) {
    const propDoc = await adminDb.collection('properties').doc(propertyId).get();
    if (!propDoc.exists || !propDoc.data()?.isListed || propDoc.data()?.features?.discovery === false) {
      throw new AppError(404, 'PG not found or not listed');
    }
    const data = propDoc.data()!;
    const listing = toListing(propDoc.id, data);

    const [photoSnap, reviewSnap, ownerDoc] = await Promise.all([
      adminDb.collection('property_photos').where('propertyId', '==', propertyId).limit(30).get(),
      adminDb
        .collection('pg_reviews')
        .where('propertyId', '==', propertyId)
        .where('hidden', '==', false)
        .limit(50)
        .get(),
      adminDb.collection('owners').doc(listing.ownerId).get(),
    ]);

    const photos = photoSnap.docs
      .map((d) => d.data() as PropertyPhoto)
      .sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt))
      .map((p) => ({
        id: p.id,
        category: p.category,
        caption: p.caption || null,
        sharingType: p.sharingType || null,
        publicUrl: p.publicUrl,
      }));

    // Hide reviews entirely if the admin disabled the reviews feature for this
    // PG (the property doc mirrors `features`; no extra read needed).
    const reviewsEnabled = data.features?.reviews !== false;
    const reviews = !reviewsEnabled
      ? []
      : reviewSnap.docs
          .map((d) => d.data() as PgReviewDoc)
          .sort((a, b) => tsToMillis(b.updatedAt) - tsToMillis(a.updatedAt))
          .map((r) => ({
            id: r.id,
            reviewerName: r.reviewerName,
            reviewerRole: r.reviewerRole,
            rating: r.rating,
            text: r.text || '',
            createdAt: tsToDate(r.updatedAt)?.toISOString() || null,
          }));

    // Public contact — phone + address only (owner opted into listing).
    const owner = ownerDoc.data() || {};
    const contact = {
      phone: owner.phone || null,
      address: data.pgAddress || owner.pgAddress || owner.address || null,
      amenities: data.pgAmenities || owner.pgAmenities || [],
      foodCuisine: data.foodCuisine || owner.foodCuisine || null,
    };

    return { listing, photos, reviews, contact };
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
      .limit(Math.min(limit, 100))
      .get();
    return snap.docs
      .map((d) => ({ ...d.data(), id: d.id } as JoinRequest))
      .sort((a, b) => tsToMillis(b.createdAt) - tsToMillis(a.createdAt));
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
