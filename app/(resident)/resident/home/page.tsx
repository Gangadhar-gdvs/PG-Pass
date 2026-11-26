'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CardListSkeleton } from '@/components/ui/skeletons';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Search, Download, MapPin, Compass } from 'lucide-react';
import { SupportLink } from '@/components/ui/support-link';
import { HeroHeader, SectionHeader } from '@/components/ui/dashboard-kit';
import { IconTile } from '@/components/brand/Icon3D';

interface Tenancy {
  tenantId: string;
  pgName: string;
  bedLabel?: string;
  roomNumber?: string;
  active: boolean;
}

export default function ResidentHome() {
  const [resident, setResident] = useState<{ name?: string } | null>(null);
  const [tenancies, setTenancies] = useState<Tenancy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/resident/me');
        if (res.ok) {
          const data = await res.json();
          setResident(data.resident);
          setTenancies(data.tenancies || []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-5 pt-2" aria-busy="true">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2.5 pt-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-40 rounded-full" />
            <Skeleton className="h-9 w-36 rounded-full" />
          </div>
          <Skeleton className="h-28 w-36 rounded-[28px]" />
        </div>
        <CardListSkeleton rows={2} height="h-[84px]" />
      </div>
    );
  }

  // The resident's current PG (first active tenancy) — shown as the location chip.
  const currentPg = tenancies.find((t) => t.active)?.pgName;

  return (
    <div className="space-y-6 pt-2">
      <HeroHeader
        variant="light"
        title="Hello,"
        highlight={
          <>
            {resident?.name || 'there'}{' '}
            {/* Own colour so the emoji isn't clipped by the gradient text fill. */}
            <span className="text-ink">👋</span>
          </>
        }
        subtitle={tenancies.length > 0 ? 'Welcome back to your PG!' : 'Find and join a PG to get started'}
        meta={
          currentPg ? (
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white bg-white/85 px-3.5 py-2 text-[13px] font-semibold text-ink shadow-[0_8px_18px_-10px_rgba(70,40,160,0.45)]">
              <MapPin className="h-4 w-4 shrink-0 text-brand" />
              <span className="truncate">{currentPg}</span>
            </span>
          ) : undefined
        }
        illustration="hero-resident"
      >
        <Link href="/resident/discover" className="btn-soft !h-11 !px-4 text-[13px]">
          <Compass className="h-4 w-4 text-brand" /> Discover PGs
        </Link>
      </HeroHeader>

      {tenancies.length === 0 ? (
        <div className="app-card p-2">
          <EmptyState
            illustration="clipboard"
            title="No PG linked yet"
            description="If your PG owner added you with this phone number, it'll appear here — or find a PG to join."
            action={
              <Link href="/resident/discover" className="btn-pill">
                <Search className="w-4 h-4" /> Find a PG
              </Link>
            }
          />
        </div>
      ) : (
        <section>
          <SectionHeader title="My PGs" icon="house" className="px-1" />
          <div className="space-y-3 stagger">
            {tenancies.map((t) => (
              <Link
                key={t.tenantId}
                href={`/resident/tenancy/${t.tenantId}`}
                className="app-card press lift flex items-center gap-3.5 p-3.5 sm:p-4"
              >
                <IconTile icon="building" tint={t.active ? 'violet' : 'slate'} size={52} />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[15.5px] font-extrabold tracking-[-0.01em] text-ink">{t.pgName}</span>
                    {!t.active && <Badge variant="vacant">Past</Badge>}
                  </div>
                  <div className="mt-0.5 text-[13px] font-medium text-ink-2/75">
                    {t.roomNumber ? `Room ${t.roomNumber} · ` : ''}Bed {t.bedLabel || '—'}
                  </div>
                </div>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-brand">
                  <ChevronRight className="h-4.5 w-4.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Privacy control: DPDP data-access/export of the resident's own data. */}
      <div className="flex flex-col items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => {
            const a = document.createElement('a');
            a.href = '/api/resident/export';
            a.download = '';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
          }}
          className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-white/60 hover:text-brand-700 press"
        >
          <Download className="w-4 h-4 text-brand" /> Download my data
        </button>
        <SupportLink subject="Resident support request" />
      </div>
    </div>
  );
}
