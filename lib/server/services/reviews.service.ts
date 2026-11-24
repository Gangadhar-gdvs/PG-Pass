import 'server-only';
import { adminDb } from '../firebase-admin';
import { AppError } from '../api/withErrorHandler';
import { recordEvent } from './systemLogs.service';
import { pgFeatureEnabled } from '../auth/entitlements';
import { PG_FEATURES } from '@/lib/constants/permissions';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Reviews — two kinds, both write-restricted to people genuinely connected to
 * the PG (prevents fake reviews), auto-public, admin-removable:
 *
 *  1. PG reviews  (`pg_reviews`)     — a verified tenant / guest / staff of the
 *                                      PG rates the PG itself (1-5 + text).
 *  2. Staff ratings (`staff_ratings`)— a verified resident of the PG rates an
 *                                      individual staff member (1-5 + note).
 *
 * Aggregates (count + sum) are kept on the property / staff docs so listings
 * can show an average without scanning the collection.
 */

type ReviewerRole = 'resident' | 'tenant' | 'staff';

export interface PgReviewInput {
  reviewerUid: string;
  reviewerRole: ReviewerRole;
  reviewerName: string;
  reviewerPhone?: string;
  ownerId: string;
  propertyId: string;
  rating: number;
  text?: string;
}

function clampRating(r: number): number {
  const n = Math.round(Number(r));
  if (!Number.isFinite(n) || n < 1 || n > 5) throw new AppError(400, 'Rating must be 1 to 5');
  return n;
}

export class ReviewsService {
  /**
   * Eligibility: is this user genuinely connected to `ownerId`'s PG?
   * - staff: staff doc scoped to this owner
   * - resident/tenant: an active-or-past tenancy OR a guest stay (phone match)
   */
  private async assertEligible(
    reviewerUid: string,
    reviewerRole: ReviewerRole,
    reviewerPhone: string | undefined,
    ownerId: string
  ) {
    if (reviewerRole === 'staff') {
      const staffDoc = await adminDb.collection('staff').doc(reviewerUid).get();
      const sd = staffDoc.data();
      if (!staffDoc.exists || sd?.ownerId !== ownerId || sd?.deletedAt || sd?.accountStatus === 'revoked') {
        throw new AppError(403, 'Only active staff of this PG can review it');
      }
      return;
    }

    // resident / tenant → look up by the reviewer's phone (the tenant link key).
    // Prefer the residents doc; fall back to a tenant doc keyed by uid so a
    // `tenant`-role caller is also resolved (not just self-service residents).
    let phone = reviewerPhone;
    if (!phone) {
      const resSnap = await adminDb.collection('residents').doc(reviewerUid).get();
      phone = resSnap.data()?.phone;
    }
    if (!phone) {
      const tenantSelf = await adminDb.collection('tenants').doc(reviewerUid).get();
      phone = tenantSelf.data()?.phone;
    }
    if (!phone) throw new AppError(403, 'Only residents or guests of this PG can review it');

    const [tenantSnap, guestSnap] = await Promise.all([
      adminDb
        .collection('tenants')
        .where('ownerId', '==', ownerId)
        .where('phone', '==', phone)
        .limit(1)
        .get(),
      adminDb
        .collection('guest_stays')
        .where('ownerId', '==', ownerId)
        .where('phone', '==', phone)
        .limit(1)
        .get(),
    ]);
    if (tenantSnap.empty && guestSnap.empty) {
      throw new AppError(403, 'Only residents or guests who stayed at this PG can review it');
    }
  }

  /** Resolve a trustworthy display name server-side (never trust client). */
  private async resolveReviewerName(uid: string, role: ReviewerRole): Promise<string> {
    const coll = role === 'staff' ? 'staff' : 'residents';
    const snap = await adminDb.collection(coll).doc(uid).get();
    return (snap.data()?.name as string) || (role === 'staff' ? 'Staff' : 'Resident');
  }

  /** Create or update the reviewer's single PG review (one per person per PG). */
  async submitPgReview(input: PgReviewInput) {
    const rating = clampRating(input.rating);
    const text = (input.text || '').trim().slice(0, 1000);

    if (!(await pgFeatureEnabled(input.ownerId, PG_FEATURES.REVIEWS))) {
      throw new AppError(403, 'Reviews are not enabled for this PG');
    }
    await this.assertEligible(input.reviewerUid, input.reviewerRole, input.reviewerPhone, input.ownerId);
    const reviewerName = await this.resolveReviewerName(input.reviewerUid, input.reviewerRole);

    // Deterministic id = one review per reviewer per property (idempotent edit).
    const reviewId = `${input.propertyId}_${input.reviewerUid}`;
    const ref = adminDb.collection('pg_reviews').doc(reviewId);
    const propRef = adminDb.collection('properties').doc(input.propertyId);

    await adminDb.runTransaction(async (tx) => {
      const [existing, prop] = await Promise.all([tx.get(ref), tx.get(propRef)]);
      const prev = existing.exists ? (existing.data()!.rating as number) : null;

      tx.set(
        ref,
        {
          id: reviewId,
          ownerId: input.ownerId,
          propertyId: input.propertyId,
          reviewerUid: input.reviewerUid,
          reviewerRole: input.reviewerRole,
          reviewerName,
          rating,
          text,
          hidden: false,
          updatedAt: Timestamp.now(),
          ...(existing.exists ? {} : { createdAt: Timestamp.now() }),
        },
        { merge: true }
      );

      // Maintain aggregate (count + sum) on the property doc.
      const agg = (prop.data()?.reviewAgg as { count: number; sum: number }) || { count: 0, sum: 0 };
      if (prev === null) {
        agg.count += 1;
        agg.sum += rating;
      } else {
        agg.sum += rating - prev; // edit: adjust by delta
      }
      tx.set(propRef, { reviewAgg: agg }, { merge: true });
    });

    await recordEvent({
      category: 'discovery',
      message: `PG review submitted (${rating}★)`,
      actorUid: input.reviewerUid,
      ownerId: input.ownerId,
      targetId: input.propertyId,
      details: { rating },
    }).catch(() => {});

    return { id: reviewId, rating, text };
  }

  /** Public list of visible PG reviews (newest first). */
  async listPgReviews(propertyId: string, limitCount = 50) {
    const snap = await adminDb
      .collection('pg_reviews')
      .where('propertyId', '==', propertyId)
      .where('hidden', '==', false)
      .limit(Math.min(limitCount, 100))
      .get();
    const rows = snap.docs.map((d) => d.data());
    // If the admin disabled reviews for this PG, hide existing reviews too.
    // (Cheap: cached feature read, and only when there is at least one review.)
    if (rows.length > 0 && !(await pgFeatureEnabled(rows[0].ownerId, PG_FEATURES.REVIEWS))) {
      return [];
    }
    rows.sort((a: any, b: any) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
    return rows.map((r: any) => ({
      id: r.id,
      reviewerName: r.reviewerName,
      reviewerRole: r.reviewerRole,
      rating: r.rating,
      text: r.text || '',
      createdAt: r.updatedAt?.toDate?.()?.toISOString?.() || null,
    }));
  }

  /** Admin: hide/unhide an abusive review (soft, reversible). */
  async setPgReviewHidden(reviewId: string, hidden: boolean, adminUid: string) {
    const ref = adminDb.collection('pg_reviews').doc(reviewId);
    const doc = await ref.get();
    if (!doc.exists) throw new AppError(404, 'Review not found');
    await ref.update({ hidden, updatedAt: Timestamp.now() });
    await recordEvent({
      category: 'security',
      message: hidden ? 'PG review hidden by admin' : 'PG review restored by admin',
      actorUid: adminUid,
      ownerId: doc.data()?.ownerId,
      targetId: reviewId,
    }).catch(() => {});
    return { success: true };
  }

  // ---------------- STAFF RATINGS (resident → individual staff) ----------------

  /** A resident of the PG rates a specific staff member. */
  async submitStaffRating(input: {
    reviewerUid: string;
    reviewerName: string;
    reviewerPhone?: string;
    staffUid: string;
    rating: number;
    note?: string;
  }) {
    const rating = clampRating(input.rating);
    const note = (input.note || '').trim().slice(0, 500);

    const staffDoc = await adminDb.collection('staff').doc(input.staffUid).get();
    if (!staffDoc.exists) throw new AppError(404, 'Staff member not found');
    const ownerId = staffDoc.data()!.ownerId as string;

    if (!(await pgFeatureEnabled(ownerId, PG_FEATURES.REVIEWS))) {
      throw new AppError(403, 'Reviews are not enabled for this PG');
    }
    // Reviewer must be a resident/guest of the same PG as the staff member.
    await this.assertEligible(input.reviewerUid, 'resident', input.reviewerPhone, ownerId);
    const reviewerName = await this.resolveReviewerName(input.reviewerUid, 'resident');

    const ratingId = `${input.staffUid}_${input.reviewerUid}`;
    const ref = adminDb.collection('staff_ratings').doc(ratingId);
    const staffRef = adminDb.collection('staff').doc(input.staffUid);

    await adminDb.runTransaction(async (tx) => {
      const [existing, staff] = await Promise.all([tx.get(ref), tx.get(staffRef)]);
      const prev = existing.exists ? (existing.data()!.rating as number) : null;

      tx.set(
        ref,
        {
          id: ratingId,
          staffUid: input.staffUid,
          ownerId,
          reviewerUid: input.reviewerUid,
          reviewerName,
          rating,
          note,
          updatedAt: Timestamp.now(),
          ...(existing.exists ? {} : { createdAt: Timestamp.now() }),
        },
        { merge: true }
      );

      const agg = (staff.data()?.ratingAgg as { count: number; sum: number }) || { count: 0, sum: 0 };
      if (prev === null) {
        agg.count += 1;
        agg.sum += rating;
      } else {
        agg.sum += rating - prev;
      }
      tx.set(staffRef, { ratingAgg: agg }, { merge: true });
    });

    await recordEvent({
      category: 'account',
      message: `Staff member rated (${rating}★)`,
      actorUid: input.reviewerUid,
      ownerId,
      targetId: input.staffUid,
      details: { rating },
    }).catch(() => {});

    return { id: ratingId, rating };
  }

  /**
   * Owner/admin: list ratings for a staff member (newest first). When
   * `scopeOwnerId` is provided (owner/staff caller), the staff member must
   * belong to that PG — prevents reading another PG's staff ratings. Admins
   * pass `undefined` to bypass.
   */
  async listStaffRatings(staffUid: string, scopeOwnerId?: string, limitCount = 50) {
    if (scopeOwnerId) {
      const staffDoc = await adminDb.collection('staff').doc(staffUid).get();
      if (!staffDoc.exists || staffDoc.data()?.ownerId !== scopeOwnerId) {
        throw new AppError(403, 'Unauthorized');
      }
    }
    const snap = await adminDb
      .collection('staff_ratings')
      .where('staffUid', '==', staffUid)
      .limit(Math.min(limitCount, 100))
      .get();
    const rows = snap.docs.map((d) => d.data());
    rows.sort((a: any, b: any) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
    return rows.map((r: any) => ({
      id: r.id,
      reviewerName: r.reviewerName,
      rating: r.rating,
      note: r.note || '',
      createdAt: r.updatedAt?.toDate?.()?.toISOString?.() || null,
    }));
  }
}

export const reviewsService = new ReviewsService();
