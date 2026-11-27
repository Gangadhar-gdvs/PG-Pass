'use client';

import { currentPeriodIST } from '@/lib/utils';
import React, { useState } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { useAsyncData, fetchJson } from '@/hooks/useAsyncData';
import { PageHeader, StatTile, SectionCard } from '@/components/ui/dashboard-kit';
import { StatGridSkeleton } from '@/components/ui/skeletons';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { Icon3D, IconBubble, type Icon3DName, type Tint } from '@/components/brand/Icon3D';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';

interface Summary {
  residents: number;
  collectedStr: string;
  pendingStr: string;
  expensesStr: string;
  netStr: string;
}

function shiftPeriod(period: string, delta: number): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function OwnerReportsPage() {
  const { ownerId } = useOwnerSession();
  const [period, setPeriod] = useState(() => currentPeriodIST());
  const [thisPeriod] = useState(() => currentPeriodIST());

  // Monthly summary loads (re-running per period) through the shared hook so a
  // failed load shows an inline error + Retry instead of an endless skeleton.
  const { data, loading, error, reload } = useAsyncData(
    () => fetchJson<{ summary: Summary }>(`/api/reports?period=${period}`),
    [ownerId, period],
    { enabled: !!ownerId }
  );
  const summary = data?.summary ?? null;

  const monthLabel = (() => {
    const [y, m] = period.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  })();

  const exports: { label: string; icon: Icon3DName; tint: Tint; href: string }[] = [
    { label: 'Residents', icon: 'users', tint: 'violet', href: `/api/reports/export?type=residents` },
    { label: `Rent (${period})`, icon: 'rupee', tint: 'mint', href: `/api/reports/export?type=rent&period=${period}` },
    { label: `Expenses (${period})`, icon: 'wallet-orange', tint: 'peach', href: `/api/reports/export?type=expenses&period=${period}` },
  ];

  // Period nav — a glass pill with round prev/next buttons (44px targets).
  const periodNav = (
    <div className="app-card flex w-full items-center justify-between gap-1 rounded-full p-1 sm:w-auto">
      <button
        type="button"
        onClick={() => setPeriod((p) => shiftPeriod(p, -1))}
        aria-label="Previous month"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-brand-700 transition-colors hover:bg-brand-50 press"
      >
        <ChevronLeft className="h-5 w-5" strokeWidth={2.4} />
      </button>
      <span className="min-w-[9.5rem] px-2 text-center text-sm font-bold text-ink">{monthLabel}</span>
      <button
        type="button"
        onClick={() => setPeriod((p) => shiftPeriod(p, 1))}
        disabled={period >= thisPeriod}
        aria-label="Next month"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-brand-700 transition-colors hover:bg-brand-50 press disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronRight className="h-5 w-5" strokeWidth={2.4} />
      </button>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-5 text-left">
      <PageHeader
        icon="report"
        tint="indigo"
        title="Reports &"
        highlight="Exports"
        subtitle="Monthly summary and CSV downloads for your records"
        actions={periodNav}
      />

      {error ? (
        <div className="app-card flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:text-left">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-ink">Couldn’t load the {monthLabel} summary</p>
            <p className="mt-0.5 text-[12.5px] font-medium text-muted">{error} You can still download the CSVs below.</p>
          </div>
          <Button variant="outline" onClick={reload} className="shrink-0">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      ) : loading || !summary ? (
        <StatGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
          <StatTile icon="users" tint="violet" label="Active Residents" value={summary.residents} />
          <StatTile icon="rupee" tint="mint" label="Collected" value={summary.collectedStr} />
          <StatTile icon="alert" tint="peach" label="Pending" value={summary.pendingStr} />
          <StatTile icon="wallet-orange" tint="amber" label="Expenses" value={summary.expensesStr} />
        </div>
      )}

      {!loading && summary && (
        <div className="app-card flex items-center gap-3.5 p-4 sm:p-5 animate-fade-up">
          <IconBubble icon="wallet" tint="violet" size={48} />
          <div className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold text-ink">Net this month</span>
            <p className="mt-0.5 text-[12px] font-medium leading-snug text-muted">
              Collected minus logged expenses — not audited profit.
            </p>
          </div>
          <span className="shrink-0 font-mono-numbers text-[22px] font-extrabold tracking-[-0.02em] text-gradient sm:text-[26px]">
            {summary.netStr}
          </span>
        </div>
      )}

      {/* Exports */}
      <SectionCard title="Download CSV" icon="doc">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {exports.map((e) => (
            <a
              key={e.label}
              href={e.href}
              className={`tint-card tint-${e.tint} flex min-h-[64px] items-center gap-3 px-3.5 py-3 press lift`}
            >
              <span className="grid shrink-0 place-items-center">
                <Icon3D name={e.icon} size={38} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-bold leading-tight text-ink">{e.label}</span>
                <span className="mt-0.5 block text-xs font-medium text-ink-2/75">CSV file</span>
              </span>
              <span
                aria-hidden="true"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/85 text-brand shadow-[0_6px_14px_-8px_rgba(70,40,160,0.5)]"
              >
                <Download className="h-4 w-4" strokeWidth={2.4} />
              </span>
            </a>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
