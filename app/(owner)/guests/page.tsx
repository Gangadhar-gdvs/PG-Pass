'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { useBeds } from '@/hooks/useBeds';
import { formatCurrency, formatDateIN, errorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CardListSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { TabBar } from '@/components/ui/tab-bar';
import { CheckInGuestModal } from '@/components/owner/CheckInGuestModal';
import { HeroHeader } from '@/components/ui/dashboard-kit';
import { UserPlus, LogOut, Phone, BedDouble } from 'lucide-react';
import toast from 'react-hot-toast';
import type { GuestStay, Bed } from '@/types';

export default function GuestsPage() {
  const { ownerId, properties, selectedPropertyId } = useOwnerSession();
  const propertyFilter = properties.length > 1 ? selectedPropertyId : undefined;
  const { beds } = useBeds(ownerId, propertyFilter);

  const [guests, setGuests] = useState<GuestStay[]>([]);
  const [tab, setTab] = useState<'active' | 'completed'>('active');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bedToCheckIn, setBedToCheckIn] = useState<Bed | null>(null);

  const vacantBeds = beds.filter((b) => b.status === 'vacant');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/guests?status=${tab}`);
      if (res.ok) setGuests((await res.json()).guests || []);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    if (!ownerId) return;
    // Defer so setState runs after commit, not in the effect body (cascading-render lint rule).
    let active = true;
    queueMicrotask(() => {
      if (active) load();
    });
    return () => {
      active = false;
    };
  }, [ownerId, load]);

  const checkout = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/guests/${id}/checkout`, { method: 'POST' });
      if (!res.ok) throw new Error('Checkout failed');
      toast.success('Guest checked out · bed freed');
      await load();
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Checkout failed'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 pt-2">
      <HeroHeader
        eyebrow="Guests"
        title="Guests"
        subtitle="Short stays — check in & out in seconds."
        right={
          <button
            type="button"
            onClick={() => {
              if (vacantBeds.length === 0) return toast.error('No vacant bed available');
              setBedToCheckIn(vacantBeds[0]);
            }}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full bg-white text-[color:var(--accent)] text-xs font-bold press shadow-sm"
          >
            <UserPlus className="w-4 h-4" /> Check in
          </button>
        }
      />

      <TabBar
        tabs={[
          { id: 'active', label: 'Staying now' },
          { id: 'completed', label: 'History' },
        ]}
        activeTab={tab}
        onChange={(id) => setTab(id as 'active' | 'completed')}
        variant="pill"
      />

      {loading ? (
        <CardListSkeleton rows={3} height="h-24" />
      ) : guests.length === 0 ? (
        <div className="app-card p-6">
          <EmptyState
            icon={<BedDouble className="w-6 h-6 accent-text" />}
            title={tab === 'active' ? 'No guests staying' : 'No past guests'}
            description={
              tab === 'active'
                ? 'Check in a guest for a short stay — pick a bed, set nights or a flat amount, done.'
                : 'Checked-out guests will appear here.'
            }
          />
        </div>
      ) : (
        <div className="space-y-3 stagger">
          {guests.map((g) => (
            <div key={g.id} className="app-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-extrabold text-[15px] text-slate-900">{g.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Bed {g.bedLabel} · {formatDateIN(g.checkInDate)} → {formatDateIN(g.checkOutDate)} · {g.nights}n
                  </div>
                  <div className="text-xs mt-1 font-mono-numbers">
                    <span className="font-bold text-slate-900">{formatCurrency(g.totalAmountPaise / 100)}</span>
                    <span className="text-slate-400">
                      {' '}
                      {g.billingMode === 'per_night' && g.nightlyRatePaise
                        ? `· ${formatCurrency(g.nightlyRatePaise / 100)}/night`
                        : '· flat'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {g.phone && (
                    <a
                      href={`tel:${g.phone}`}
                      className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center press"
                      aria-label="Call guest"
                    >
                      <Phone className="w-4 h-4 text-slate-600" />
                    </a>
                  )}
                  {g.status === 'active' && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === g.id}
                      loading={busyId === g.id}
                      onClick={() => checkout(g.id)}
                    >
                      <LogOut className="w-3.5 h-3.5" /> Check out
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {bedToCheckIn && (
        <CheckInGuestModal
          bed={bedToCheckIn}
          isOpen={!!bedToCheckIn}
          onClose={() => setBedToCheckIn(null)}
          onSuccess={load}
        />
      )}
    </div>
  );
}
