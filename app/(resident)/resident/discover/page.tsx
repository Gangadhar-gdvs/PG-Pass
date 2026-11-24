'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Search, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';

interface Listing {
  propertyId: string;
  pgName: string;
  city?: string;
  area?: string;
  pgCategory?: string;
  monthlyRent?: number;
}

export default function DiscoverPage() {
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

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
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Find a PG</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
        className="space-y-2"
      >
        <Input label="Search by name or area" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Koramangala, Sunrise PG" />
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Input label="City" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Bengaluru" />
          </div>
          <Button type="submit" variant="solid" className="bg-[#0D9488] hover:bg-[#0F766E] h-11">
            <Search className="w-4 h-4" />
          </Button>
        </div>
      </form>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
      ) : listings.length === 0 ? (
        <EmptyState
          icon={<Search className="w-6 h-6 text-[#0D9488]" />}
          title="No PGs found"
          description="Try a different city or search term. Only PGs that opted into public listing appear here."
        />
      ) : (
        <div className="space-y-2">
          {listings.map((l) => (
            <div key={l.propertyId} className="bg-white border border-[#CCFBF1] rounded-[12px] p-4 shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-sm">{l.pgName}</div>
                  <div className="text-xs text-[#64748B] flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {[l.area, l.city].filter(Boolean).join(', ') || 'Location n/a'}
                  </div>
                  <div className="text-[11px] text-[#94A3B8] mt-0.5 capitalize">
                    {l.pgCategory || 'coliving'}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={joiningId === l.propertyId}
                  onClick={() => join(l.propertyId)}
                >
                  Request Join
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
