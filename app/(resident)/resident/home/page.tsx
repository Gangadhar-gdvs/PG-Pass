'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CardListSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { Building2, ChevronRight, Search } from 'lucide-react';
import { SupportLink } from '@/components/ui/support-link';

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
      <div className="space-y-3 pt-4">
        <CardListSkeleton rows={2} height="h-24" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      <h1 className="text-xl font-extrabold text-slate-900 px-1">
        Hi {resident?.name?.split(' ')[0] || 'there'} 👋
      </h1>

      {tenancies.length === 0 ? (
        <div className="app-card p-6">
          <EmptyState
            icon={<Building2 className="w-6 h-6 accent-text" />}
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
        <div className="space-y-3 stagger">
          {tenancies.map((t) => (
            <Link
              key={t.tenantId}
              href={`/resident/tenancy/${t.tenantId}`}
              className="app-card press flex items-center gap-4 p-4"
            >
              <div className="w-12 h-12 rounded-[16px] accent-soft-bg flex items-center justify-center shrink-0">
                <Building2 className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-extrabold text-[15px] text-slate-900 truncate">{t.pgName}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {t.roomNumber ? `Room ${t.roomNumber} · ` : ''}Bed {t.bedLabel || '—'}
                  {!t.active && (
                    <span className="ml-2 inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-bold">
                      PAST
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
            </Link>
          ))}
        </div>
      )}

      <div className="pt-2 flex justify-center">
        <SupportLink subject="Resident support request" />
      </div>
    </div>
  );
}
