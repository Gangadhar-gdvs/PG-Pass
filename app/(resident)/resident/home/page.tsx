'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Building2, ChevronRight, Search } from 'lucide-react';

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
      <div className="space-y-3">
        <Skeleton className="h-7 w-40" />
        {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Hi {resident?.name || 'there'} 👋</h1>

      {tenancies.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-6 h-6 text-[#0D9488]" />}
          title="No PG linked yet"
          description="If your PG owner added you with this phone number, it'll appear here. Or find a PG to join."
          action={
            <Link
              href="/resident/discover"
              className="inline-flex items-center gap-1.5 h-11 px-4 rounded-[8px] bg-[#0D9488] text-white text-sm font-semibold"
            >
              <Search className="w-4 h-4" /> Find a PG
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {tenancies.map((t) => (
            <Link
              key={t.tenantId}
              href={`/resident/tenancy/${t.tenantId}`}
              className="block bg-white border border-[#CCFBF1] rounded-[12px] p-4 shadow-xs active:bg-[#F0FDFA]"
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="font-bold text-sm truncate">{t.pgName}</div>
                  <div className="text-xs text-[#64748B]">
                    {t.roomNumber ? `Room ${t.roomNumber} · ` : ''}Bed {t.bedLabel || '—'}
                    {!t.active && <span className="ml-2 text-[#94A3B8]">(past)</span>}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-[#94A3B8] shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
