'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { HeroHeader, StatTile } from '@/components/ui/dashboard-kit';
import { StatGridSkeleton } from '@/components/ui/skeletons';
import { BarChart3, Users, IndianRupee, Download, Receipt, Wallet, FileText } from 'lucide-react';

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
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?period=${p}`);
      if (res.ok) setSummary((await res.json()).summary);
    } catch {
      /* non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ownerId) return;
    let active = true;
    queueMicrotask(() => {
      if (active) load(period);
    });
    return () => {
      active = false;
    };
  }, [ownerId, period, load]);

  const monthLabel = (() => {
    const [y, m] = period.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  })();

  const exports = [
    { label: 'Residents', icon: <Users className="h-4 w-4" />, href: `/api/reports/export?type=residents` },
    { label: `Rent (${period})`, icon: <Receipt className="h-4 w-4" />, href: `/api/reports/export?type=rent&period=${period}` },
    { label: `Expenses (${period})`, icon: <Wallet className="h-4 w-4" />, href: `/api/reports/export?type=expenses&period=${period}` },
  ];

  return (
    <div className="space-y-4 text-left">
      <div className="-mx-4 -mt-4 sm:-mx-6 md:mx-0 md:mt-0">
        <HeroHeader
          eyebrow={<><BarChart3 className="h-3 w-3" /> Reports</>}
          title="Reports & Exports"
          subtitle="Monthly summary and CSV downloads for your records"
        />
      </div>

      {/* Period nav */}
      <div className="flex items-center justify-between app-card px-3 py-2">
        <button type="button" onClick={() => setPeriod((p) => shiftPeriod(p, -1))} className="h-10 px-3 rounded-[10px] text-sm font-bold text-[#64748B] hover:bg-[#F8FAFC]">‹</button>
        <span className="text-sm font-bold text-[#0F172A]">{monthLabel}</span>
        <button
          type="button"
          onClick={() => setPeriod((p) => shiftPeriod(p, 1))}
          disabled={period >= new Date().toISOString().slice(0, 7)}
          className="h-10 px-3 rounded-[10px] text-sm font-bold text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-30"
        >›</button>
      </div>

      {loading || !summary ? (
        <StatGridSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <StatTile icon={<Users className="h-5 w-5 text-[#6D28D9]" />} tint="violet" label="Active Residents" value={summary.residents} />
          <StatTile icon={<IndianRupee className="h-5 w-5 text-[#0F766E]" />} tint="mint" label="Collected" value={summary.collectedStr} />
          <StatTile icon={<IndianRupee className="h-5 w-5 text-[#C2410C]" />} tint="peach" label="Pending" value={summary.pendingStr} />
          <StatTile icon={<Wallet className="h-5 w-5 text-[#1D4ED8]" />} tint="sky" label="Expenses" value={summary.expensesStr} />
        </div>
      )}

      {!loading && summary && (
        <div className="app-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-[#0F172A]">Net this month</span>
            <span className="font-mono-numbers text-lg font-extrabold accent-text">{summary.netStr}</span>
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">Collected minus logged expenses — not audited profit.</p>
        </div>
      )}

      {/* Exports */}
      <section className="app-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="h-4 w-4 accent-text" />
          <h2 className="text-sm font-bold text-[#0F172A]">Download CSV</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {exports.map((e) => (
            <a
              key={e.label}
              href={e.href}
              className="tint-card tint-violet flex items-center justify-between px-3.5 py-3 press"
            >
              <span className="flex items-center gap-2 text-xs font-bold">{e.icon}{e.label}</span>
              <Download className="h-4 w-4" />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
