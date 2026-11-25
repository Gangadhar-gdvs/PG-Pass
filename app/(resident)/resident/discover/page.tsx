'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { CardListSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { Search, MapPin, Building2, Star } from 'lucide-react';
import toast from 'react-hot-toast';
import { PgDetailDrawer } from '@/components/resident/PgDetailDrawer';

interface Listing {
  propertyId: string;
  pgName: string;
  city?: string;
  area?: string;
  pgCategory?: string;
  coverPhotoUrl?: string;
  ratingAvg?: number;
  ratingCount?: number;
}

export default function DiscoverPage() {
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

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
    search();
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
    } catch (e: any) {
      toast.error(e.message || 'Could not send request');
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="space-y-4 pt-4">
      <h1 className="text-xl font-extrabold text-slate-900 px-1">Find a PG</h1>

      {/* Search card */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
        className="app-card p-3.5 space-y-2.5"
      >
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or area…"
            className="w-full h-12 pl-10 pr-3 rounded-[14px] border-2 border-slate-200 text-sm focus:border-[color:var(--accent)] focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City (e.g. Bengaluru)"
            className="flex-1 h-12 px-4 rounded-[14px] border-2 border-slate-200 text-sm focus:border-[color:var(--accent)] focus:outline-none"
          />
          <Button type="submit" variant="solid" size="md">
            <Search className="w-4 h-4" /> Search
          </Button>
        </div>
      </form>

      {loading ? (
        <CardListSkeleton rows={3} height="h-24" />
      ) : listings.length === 0 ? (
        <div className="app-card p-6">
          <EmptyState
            icon={<Search className="w-6 h-6 accent-text" />}
            title="No PGs found"
            description="Try a different city or term. Only PGs that opted into public listing appear here."
          />
        </div>
      ) : (
        <div className="space-y-2.5 stagger">
          {listings.map((l) => (
            <button
              key={l.propertyId}
              type="button"
              onClick={() => setDetailId(l.propertyId)}
              className="app-card p-4 flex items-center gap-3.5 w-full text-left press cursor-pointer"
            >
              {l.coverPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={l.coverPhotoUrl}
                  alt={l.pgName}
                  className="w-14 h-14 rounded-[16px] object-cover shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-[16px] accent-soft-bg flex items-center justify-center shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-[15px] text-slate-900 truncate">{l.pgName}</div>
                <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  {[l.area, l.city].filter(Boolean).join(', ') || 'Location n/a'}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-slate-400 capitalize">{l.pgCategory || 'coliving'}</span>
                  {(l.ratingCount ?? 0) > 0 && (
                    <span className="text-[11px] font-bold text-amber-600 flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                      {l.ratingAvg} ({l.ratingCount})
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs font-bold accent-text shrink-0">View →</span>
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
