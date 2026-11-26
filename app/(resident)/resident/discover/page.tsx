'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input, SearchInput } from '@/components/ui/input';
import { CardListSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { Search, MapPin, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { PgDetailDrawer } from '@/components/resident/PgDetailDrawer';
import { PageHeader, FilterChips } from '@/components/ui/dashboard-kit';
import { Icon3D, IconTile } from '@/components/brand/Icon3D';
import { errorMessage, formatCurrency } from '@/lib/utils';

interface Listing {
  propertyId: string;
  pgName: string;
  city?: string;
  area?: string;
  pgCategory?: string;
  foodPlan?: string;
  monthlyRent?: number;
  coverPhotoUrl?: string;
  ratingAvg?: number;
  ratingCount?: number;
}

const ALL = 'all';

export default function DiscoverPage() {
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  // Client-side narrowing of the returned results by PG type (no extra fetch).
  const [category, setCategory] = useState<string>(ALL);

  const search = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set('q', q.trim());
      if (city.trim()) qs.set('city', city.trim());
      const res = await fetch(`/api/discover?${qs.toString()}`);
      if (res.ok) setListings((await res.json()).listings || []);
    } finally {
      setLoading(false);
    }
  }, [q, city]);

  useEffect(() => {
    // Defer so setState runs after commit, not in the effect body (cascading-render lint rule).
    let active = true;
    queueMicrotask(() => {
      if (active) search();
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const join = async (propertyId: string) => {
    if (joiningId) return;
    setJoiningId(propertyId);
    try {
      const res = await fetch(`/api/discover/${propertyId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Could not send request');
      toast.success('Join request sent — the PG owner will review it.');
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Could not send request'));
    } finally {
      setJoiningId(null);
    }
  };

  // Category chips are derived from the current results; if a new search drops
  // the selected category, fall back to "All" (derived, not synced).
  const categories = Array.from(new Set(listings.map((l) => l.pgCategory || 'coliving')));
  const activeCategory = categories.includes(category) ? category : ALL;
  const visible =
    activeCategory === ALL ? listings : listings.filter((l) => (l.pgCategory || 'coliving') === activeCategory);
  const chipOptions = [
    { value: ALL, label: 'All', count: listings.length },
    ...categories.map((c) => ({
      value: c,
      label: <span className="capitalize">{c}</span>,
      count: listings.filter((l) => (l.pgCategory || 'coliving') === c).length,
    })),
  ];

  return (
    <div className="space-y-5 pt-3">
      <PageHeader
        icon="building"
        tint="violet"
        title="Find a"
        highlight="PG"
        subtitle="Browse PGs near you and request to join."
      />

      {/* Search card */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
        className="app-card p-3.5 sm:p-4 space-y-2.5"
      >
        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or area…"
          aria-label="Search name or area"
        />
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <Input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City (e.g. Bengaluru)"
              aria-label="City"
              leading={<MapPin />}
            />
          </div>
          <Button type="submit" variant="solid" size="lg" className="!px-4 sm:!px-6">
            <Search className="w-4 h-4" /> Search
          </Button>
        </div>
      </form>

      {!loading && categories.length > 1 && (
        <FilterChips options={chipOptions} value={activeCategory} onChange={setCategory} className="-mx-1 px-1 pb-1" />
      )}

      {loading ? (
        <CardListSkeleton rows={3} height="h-[112px]" />
      ) : visible.length === 0 ? (
        <div className="app-card p-2">
          <EmptyState
            illustration="clipboard"
            title="No PGs found"
            description="Try a different city or term. Only PGs that opted into public listing appear here."
          />
        </div>
      ) : (
        <div className="space-y-3 stagger">
          {visible.map((l) => (
            <button
              key={l.propertyId}
              type="button"
              onClick={() => setDetailId(l.propertyId)}
              className="app-card lift press flex w-full items-stretch gap-3.5 p-3 text-left cursor-pointer"
            >
              {l.coverPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={l.coverPhotoUrl}
                  alt={l.pgName}
                  className="h-[88px] w-[88px] shrink-0 rounded-2xl object-cover shadow-[0_8px_18px_-10px_rgba(70,40,160,0.45)]"
                />
              ) : (
                <IconTile icon="building" tint="violet" size={88} className="!rounded-2xl" />
              )}
              <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                <div className="min-w-0">
                  <div className="truncate text-[15.5px] font-extrabold tracking-[-0.01em] text-ink">{l.pgName}</div>
                  <div className="mt-0.5 flex min-w-0 items-center gap-1 text-[12.5px] font-medium text-ink-2/75">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-brand" />
                    <span className="truncate">{[l.area, l.city].filter(Boolean).join(', ') || 'Location n/a'}</span>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {typeof l.monthlyRent === 'number' && l.monthlyRent > 0 && (
                    <span className="chip font-mono-numbers font-bold">{formatCurrency(l.monthlyRent)}/mo</span>
                  )}
                  <span className="chip bg-lilac-2 text-ink-2 capitalize">{l.pgCategory || 'coliving'}</span>
                  {l.foodPlan && (
                    <span className="chip bg-lilac-2 text-ink-2 capitalize">{l.foodPlan.replace('_', ' ')}</span>
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  {(l.ratingCount ?? 0) > 0 ? (
                    <span className="inline-flex items-center gap-1 text-[12.5px] font-bold text-ink">
                      <Icon3D name="star" size={16} />
                      {l.ratingAvg}
                      <span className="font-medium text-muted">({l.ratingCount})</span>
                    </span>
                  ) : (
                    <span className="text-[12px] font-medium text-faint">No reviews yet</span>
                  )}
                  <span className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-brand-700">
                    View <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.6} />
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <PgDetailDrawer
        propertyId={detailId}
        onClose={() => setDetailId(null)}
        onJoin={join}
        joiningId={joiningId}
      />
    </div>
  );
}
