'use client';

import React, { useEffect, useState } from 'react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Star, MapPin, Phone, Utensils, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/lib/utils';

interface DetailPhoto {
  id: string;
  category: string;
  caption: string | null;
  sharingType: string | null;
  publicUrl: string;
}
interface DetailReview {
  id: string;
  reviewerName: string;
  reviewerRole: string;
  rating: number;
  text: string;
}
interface Detail {
  listing: {
    propertyId: string;
    ownerId: string;
    pgName: string;
    city?: string;
    area?: string;
    pgCategory?: string;
    foodPlan?: string;
    ratingAvg?: number;
    ratingCount?: number;
  };
  photos: DetailPhoto[];
  reviews: DetailReview[];
  contact: { phone: string | null; address: string | null; amenities: string[]; foodCuisine: string | null };
}

function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={onChange ? 'cursor-pointer' : 'cursor-default'}
          aria-label={`${n} star`}
        >
          <Star
            className={`w-5 h-5 ${n <= value ? 'fill-amber-500 text-amber-500' : 'text-slate-300'}`}
          />
        </button>
      ))}
    </div>
  );
}

/**
 * Public PG detail for residents: gallery, reviews, contact + join. Also lets an
 * eligible resident (past/current tenant or guest) leave a review — the server
 * rejects anyone not connected to the PG.
 */
export function PgDetailDrawer({
  propertyId,
  onClose,
  onJoin,
  joiningId,
}: {
  propertyId: string | null;
  onClose: () => void;
  onJoin: (propertyId: string) => void;
  joiningId: string | null;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [myText, setMyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Defer so setState runs after commit, not in the effect body (cascading-render lint rule).
    if (!propertyId) {
      queueMicrotask(() => setDetail(null));
      return;
    }
    queueMicrotask(() => {
      setLoading(true);
      setMyRating(0);
      setMyText('');
    });
    fetch(`/api/discover/${propertyId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setDetail)
      .catch(() => toast.error('Could not load PG details'))
      .finally(() => setLoading(false));
  }, [propertyId]);

  const submitReview = async () => {
    if (!detail || myRating < 1) {
      toast.error('Pick a star rating first');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId: detail.listing.ownerId,
          propertyId: detail.listing.propertyId,
          rating: myRating,
          text: myText.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not submit review');
      toast.success('Thanks! Your review is posted.');
      // Refresh detail to show the new review.
      const refreshed = await fetch(`/api/discover/${detail.listing.propertyId}`);
      if (refreshed.ok) setDetail(await refreshed.json());
      setMyText('');
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not submit review'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      isOpen={!!propertyId}
      onClose={onClose}
      title={detail?.listing.pgName || 'PG Details'}
      width="lg"
      footer={
        detail ? (
          <Button
            variant="solid"
            size="lg"
            className="w-full"
            loading={joiningId === detail.listing.propertyId}
            onClick={() => onJoin(detail.listing.propertyId)}
          >
            Request to Join this PG
          </Button>
        ) : undefined
      }
    >
      {loading || !detail ? (
        <div className="py-10 text-center text-sm text-slate-400">Loading…</div>
      ) : (
        <div className="space-y-5">
          {/* Rating summary + location */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              {(detail.listing.ratingCount ?? 0) > 0 ? (
                <>
                  <Stars value={Math.round(detail.listing.ratingAvg || 0)} />
                  <span className="text-sm font-bold text-slate-700">
                    {detail.listing.ratingAvg}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({detail.listing.ratingCount} review{detail.listing.ratingCount === 1 ? '' : 's'})
                  </span>
                </>
              ) : (
                <span className="text-xs text-slate-400">No reviews yet</span>
              )}
            </div>
            {detail.contact.address && (
              <div className="text-xs text-slate-500 flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{detail.contact.address}</span>
              </div>
            )}
            {detail.contact.phone && (
              <a
                href={`tel:${detail.contact.phone}`}
                className="text-xs font-semibold accent-text flex items-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5" /> {detail.contact.phone}
              </a>
            )}
            {detail.contact.foodCuisine && (
              <div className="text-xs text-slate-500 flex items-center gap-1.5 capitalize">
                <Utensils className="w-3.5 h-3.5" /> {detail.listing.foodPlan?.replace('_', ' ')} ·{' '}
                {detail.contact.foodCuisine}
              </div>
            )}
          </div>

          {/* Photos */}
          {detail.photos.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Photos</h3>
              <div className="grid grid-cols-2 gap-2">
                {detail.photos.map((p) => (
                  <div key={p.id} className="rounded-[12px] overflow-hidden border border-slate-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.publicUrl} alt={p.caption || p.category} className="w-full h-28 object-cover" />
                    <div className="px-2 py-1 text-[10px] font-semibold text-slate-500 capitalize">
                      {p.category}
                      {p.sharingType ? ` · ${p.sharingType}-sharing` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Amenities */}
          {detail.contact.amenities.length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Amenities</h3>
              <div className="flex flex-wrap gap-1.5">
                {detail.contact.amenities.map((a) => (
                  <span
                    key={a}
                    className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-1 rounded-full flex items-center gap-1 capitalize"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Write a review (server verifies eligibility) */}
          <div className="app-card p-3.5 space-y-2.5">
            <h3 className="text-xs font-bold text-slate-700">Rate this PG</h3>
            <p className="text-[11px] text-slate-400">
              Only residents or guests who stayed here can review.
            </p>
            <Stars value={myRating} onChange={setMyRating} />
            <textarea
              value={myText}
              onChange={(e) => setMyText(e.target.value)}
              placeholder="Share your experience (optional)…"
              rows={3}
              maxLength={1000}
              className="w-full px-3 py-2 rounded-[12px] border-2 border-slate-200 text-sm focus:border-[color:var(--accent)] focus:outline-none"
            />
            <Button variant="solid" size="sm" loading={submitting} onClick={submitReview}>
              Post review
            </Button>
          </div>

          {/* Reviews */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">Reviews</h3>
            {detail.reviews.length === 0 ? (
              <p className="text-xs text-slate-400">Be the first to review this PG.</p>
            ) : (
              <div className="space-y-2.5">
                {detail.reviews.map((r) => (
                  <div key={r.id} className="app-card p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-800">{r.reviewerName}</span>
                      <Stars value={r.rating} />
                    </div>
                    <span className="text-[10px] uppercase font-semibold text-slate-400">
                      {r.reviewerRole}
                    </span>
                    {r.text && <p className="text-xs text-slate-600 mt-1">{r.text}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
