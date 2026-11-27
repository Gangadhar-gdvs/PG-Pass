'use client';

import React, { useState } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { useBeds } from '@/hooks/useBeds';
import { useAsyncData, fetchJson } from '@/hooks/useAsyncData';
import { apiPost } from '@/lib/client/api';
import { LoadError } from '@/components/ui/load-error';
import { formatCurrency, formatDateIN, errorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ListSkeleton, StatGridSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { TabBar } from '@/components/ui/tab-bar';
import { CheckInGuestModal } from '@/components/owner/CheckInGuestModal';
import { PageHeader, SectionCard, StatTile } from '@/components/ui/dashboard-kit';
import { UserPlus, LogOut, Phone, BedDouble, CalendarDays, Moon } from 'lucide-react';
import toast from 'react-hot-toast';
import type { GuestStay, Bed } from '@/types';

export default function GuestsPage() {
  const { ownerId, properties, selectedPropertyId } = useOwnerSession();
  const propertyFilter = properties.length > 1 ? selectedPropertyId : undefined;
  const { beds } = useBeds(ownerId, propertyFilter);

  const [tab, setTab] = useState<'active' | 'completed'>('active');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bedToCheckIn, setBedToCheckIn] = useState<Bed | null>(null);

  const vacantBeds = beds.filter((b) => b.status === 'vacant');

  // Loads (re-running per tab) through the shared hook so a failed load shows an
  // error + Retry instead of a silently-empty guest list.
  const { data, loading, error, reload } = useAsyncData(
    () => fetchJson<{ guests?: GuestStay[] }>(`/api/guests?status=${tab}`),
    [ownerId, tab],
    { enabled: !!ownerId }
  );
  const load = reload;
  const guests = data?.guests ?? [];

  const checkout = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      await apiPost(`/api/guests/${id}/checkout`);
      toast.success('Guest checked out · bed freed');
      load();
    } catch (e: unknown) {
      toast.error(errorMessage(e, 'Checkout failed'));
    } finally {
      setBusyId(null);
    }
  };

  // Display-only totals for the list currently shown (this tab).
  const totalNights = guests.reduce((sum, g) => sum + (g.nights || 0), 0);
  const totalBilledPaise = guests.reduce((sum, g) => sum + (g.totalAmountPaise || 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        icon="bed-teal"
        tint="mint"
        title="Guests"
        subtitle="Short stays — check in & out in seconds."
        actions={
          <Button
            onClick={() => {
              if (vacantBeds.length === 0) return toast.error('No vacant bed available');
              setBedToCheckIn(vacantBeds[0]);
            }}
          >
            <UserPlus className="h-4 w-4" /> Check in
          </Button>
        }
      />

      {error ? (
        <LoadError message={error} onRetry={reload} />
      ) : (
        <>
      {loading ? (
        <StatGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
          <StatTile
            icon="bed-teal"
            tint="mint"
            label={tab === 'active' ? 'Staying Now' : 'Past Guests'}
            value={guests.length}
          />
          <StatTile icon="bed" tint="sky" label="Vacant Beds" value={vacantBeds.length} />
          <StatTile icon="calendar" tint="violet" label="Guest Nights" value={totalNights} />
          <StatTile icon="rupee" tint="peach" label="Total Billed" value={formatCurrency(totalBilledPaise / 100)} />
        </div>
      )}

      <TabBar
        tabs={[
          { id: 'active', label: 'Staying now' },
          { id: 'completed', label: 'History' },
        ]}
        activeTab={tab}
        onChange={(id) => setTab(id as 'active' | 'completed')}
        variant="pill"
        className="w-fit"
      />

      {loading ? (
        <ListSkeleton rows={3} />
      ) : guests.length === 0 ? (
        <div className="app-card">
          <EmptyState
            icon3d="bed-teal"
            title={tab === 'active' ? 'No guests staying' : 'No past guests'}
            description={
              tab === 'active'
                ? 'Check in a guest for a short stay — pick a bed, set nights or a flat amount, done.'
                : 'Checked-out guests will appear here.'
            }
          />
        </div>
      ) : (
        <SectionCard
          title={tab === 'active' ? 'Staying now' : 'History'}
          icon={tab === 'active' ? 'bed-teal' : 'clock'}
          action={<span className="chip font-mono-numbers">{guests.length}</span>}
        >
          <ul className="divide-y divide-line stagger">
            {guests.map((g) => {
              const isActive = g.status === 'active';
              return (
                <li key={g.id} className="py-3.5 first:pt-1 last:pb-1">
                  <div className="flex items-start gap-3">
                    <Avatar name={g.name} size="lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[15px] font-bold text-ink">{g.name}</div>
                          <div className="mt-0.5 flex items-center gap-1 text-[12.5px] font-medium text-muted">
                            <BedDouble className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">Bed {g.bedLabel}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-mono-numbers text-[15px] font-extrabold text-ink">
                            {formatCurrency(g.totalAmountPaise / 100)}
                          </div>
                          <div className="font-mono-numbers text-[11.5px] font-medium text-muted">
                            {g.billingMode === 'per_night' && g.nightlyRatePaise
                              ? `${formatCurrency(g.nightlyRatePaise / 100)}/night`
                              : 'flat'}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <span className="chip font-mono-numbers">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDateIN(g.checkInDate)} → {formatDateIN(g.checkOutDate)}
                        </span>
                        <span className="chip font-mono-numbers">
                          <Moon className="h-3.5 w-3.5" />
                          {g.nights}n
                        </span>
                        <Badge variant={isActive ? 'paid' : 'vacant'} dot>
                          {isActive ? 'Staying' : 'Checked out'}
                        </Badge>
                      </div>

                      {(g.phone || isActive) && (
                        <div className="mt-3 flex items-center gap-2">
                          {g.phone && (
                            <a
                              href={`tel:${g.phone}`}
                              className="inline-grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700 transition-colors hover:bg-brand-100 press"
                              aria-label="Call guest"
                            >
                              <Phone className="h-4 w-4" />
                            </a>
                          )}
                          {isActive && (
                            <Button
                              variant="outline"
                              disabled={busyId === g.id}
                              loading={busyId === g.id}
                              onClick={() => checkout(g.id)}
                            >
                              <LogOut className="h-4 w-4" /> Check out
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}
        </>
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
