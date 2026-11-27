'use client';

import React, { useEffect, useState } from 'react';
import { Drawer } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { KeyValue, SectionHeader } from '@/components/ui/dashboard-kit';
import { Icon3D, IconTile } from '@/components/brand/Icon3D';
import { Star, MapPin, Phone, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { errorMessage } from '@/lib/utils';
import { apiGet, apiPost } from '@/lib/client/api';

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

/**
 * Star row. Read-only stars are compact; interactive stars get 44px touch
 * targets. Filled = warm orange, empty = lavender outline.
 */
function Stars({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  const interactive = Boolean(onChange);
  return (
    <div className={`flex items-center ${interactive ? '-ml-2' : 'gap-0.5'}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={
            interactive
              ? 'grid h-11 w-11 place-items-center rounded-full cursor-pointer transition-transform hover:bg-brand-50 active:scale-90'
              : 'cursor-default'
          }
          aria-label={`${n} star`}
        >
          <Star
            className={`${interactive ? 'h-7 w-7' : 'h-4 w-4'} ${
              n <= value ? 'fill-warning text-warning' : 'text-line-strong'
            }`}
            strokeWidth={interactive ? 1.8 : 2}
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
    apiGet<Detail>(`/api/discover/${propertyId}`)
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
      await apiPost('/api/reviews', {
        ownerId: detail.listing.ownerId,
        propertyId: detail.listing.propertyId,
        rating: myRating,
        text: myText.trim() || undefined,
      });
      toast.success('Thanks! Your review is posted.');
      // Refresh detail to show the new review (best-effort).
      const refreshed = await apiGet<Detail>(`/api/discover/${detail.listing.propertyId}`).catch(() => null);
      if (refreshed) setDetail(refreshed);
      setMyText('');
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not submit review'));
    } finally {
      setSubmitting(false);
    }
  };

  const location = detail ? [detail.listing.area, detail.listing.city].filter(Boolean).join(', ') : '';
  const food = detail?.contact.foodCuisine
    ? [detail.listing.foodPlan?.replace('_', ' '), detail.contact.foodCuisine].filter(Boolean).join(' · ')
    : '';

  return (
    <Drawer
      isOpen={!!propertyId}
      onClose={onClose}
      title={detail?.listing.pgName || 'PG Details'}
      description={location || undefined}
      width="lg"
      footer={
        detail ? (
          <Button
            variant="solid"
            size="full"
            loading={joiningId === detail.listing.propertyId}
            onClick={() => onJoin(detail.listing.propertyId)}
          >
            Request to Join this PG
          </Button>
        ) : undefined
      }
    >
      {loading || !detail ? (
        <div className="space-y-4" aria-busy="true">
          <span className="sr-only">Loading…</span>
          <Skeleton className="h-44 w-full rounded-[22px]" />
          <Skeleton className="h-28 w-full rounded-[22px]" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
            <Skeleton className="h-8 w-28 rounded-full" />
          </div>
          <Skeleton className="h-40 w-full rounded-[22px]" />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Gallery — swipeable on phones */}
          {detail.photos.length > 0 && (
            <div className="-mx-5 md:-mx-6">
              <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 md:px-6 pb-2 no-scrollbar">
                {detail.photos.map((p) => (
                  <figure key={p.id} className="w-[78%] sm:w-[60%] shrink-0 snap-start">
                    <div className="overflow-hidden rounded-2xl border border-white bg-white shadow-[0_12px_26px_-16px_rgba(70,40,160,0.45)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.publicUrl} alt={p.caption || p.category} className="h-44 w-full object-cover" />
                    </div>
                    <figcaption className="mt-1.5 px-1 text-[12px] font-semibold text-ink-2/75 capitalize">
                      {p.category}
                      {p.sharingType ? ` · ${p.sharingType}-sharing` : ''}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}

          {/* Rating summary + location + contact */}
          <div className="app-card p-4 space-y-3">
            <div className="flex items-start gap-3">
              <IconTile icon="building" tint="violet" size={48} />
              <div className="min-w-0 flex-1 space-y-1">
                {(detail.listing.ratingCount ?? 0) > 0 ? (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Stars value={Math.round(detail.listing.ratingAvg || 0)} />
                    <span className="text-[15px] font-extrabold font-mono-numbers text-ink">
                      {detail.listing.ratingAvg}
                    </span>
                    <span className="text-[12.5px] font-medium text-muted">
                      ({detail.listing.ratingCount} review{detail.listing.ratingCount === 1 ? '' : 's'})
                    </span>
                  </div>
                ) : (
                  <span className="text-[13px] font-medium text-muted">No reviews yet</span>
                )}
                {detail.contact.address && (
                  <div className="flex items-start gap-1.5 text-[13px] font-medium text-ink-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    <span>{detail.contact.address}</span>
                  </div>
                )}
              </div>
            </div>

            {(detail.contact.phone || food) && (
              <div className="well divide-y divide-line px-3.5">
                {food && <KeyValue label="Food" value={<span className="capitalize">{food}</span>} />}
                {detail.contact.phone && (
                  <KeyValue
                    label="Contact"
                    value={
                      <a
                        href={`tel:${detail.contact.phone}`}
                        className="inline-flex min-h-[44px] items-center gap-1.5 text-brand-700"
                      >
                        <Phone className="h-4 w-4" /> {detail.contact.phone}
                      </a>
                    }
                    className="!py-0"
                  />
                )}
              </div>
            )}
          </div>

          {/* Amenities */}
          {detail.contact.amenities.length > 0 && (
            <section>
              <SectionHeader title="Amenities" icon="grid" className="px-1" />
              <div className="flex flex-wrap gap-2">
                {detail.contact.amenities.map((a) => (
                  <span key={a} className="chip capitalize">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" /> {a}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Write a review (server verifies eligibility) */}
          <div className="app-card p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Icon3D name="star" size={34} />
              <div className="min-w-0">
                <h3 className="text-[15px] font-bold text-ink">Rate this PG</h3>
                <p className="mt-0.5 text-[12.5px] font-medium text-muted">
                  Only residents or guests who stayed here can review.
                </p>
              </div>
            </div>
            <Stars value={myRating} onChange={setMyRating} />
            <Textarea
              value={myText}
              onChange={(e) => setMyText(e.target.value)}
              placeholder="Share your experience (optional)…"
              aria-label="Share your experience"
              rows={3}
              maxLength={1000}
            />
            <Button variant="solid" size="md" loading={submitting} onClick={submitReview}>
              Post review
            </Button>
          </div>

          {/* Reviews */}
          <section>
            <SectionHeader title="Reviews" icon="megaphone" className="px-1" />
            {detail.reviews.length === 0 ? (
              <p className="px-1 text-[13px] font-medium text-muted">Be the first to review this PG.</p>
            ) : (
              <div className="app-card divide-y divide-line px-4">
                {detail.reviews.map((r) => (
                  <div key={r.id} className="flex items-start gap-3 py-3.5">
                    <Avatar name={r.reviewerName} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                        <span className="truncate text-[14px] font-bold text-ink">{r.reviewerName}</span>
                        <Stars value={r.rating} />
                      </div>
                      <span className="text-[12px] font-medium text-muted capitalize">{r.reviewerRole}</span>
                      {r.text && <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{r.text}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </Drawer>
  );
}
