'use client';

import React, { useState, useEffect } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { formatCurrency } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { BarChart3, TrendingUp, Building2, IndianRupee, AlertTriangle } from 'lucide-react';

interface PeriodStat {
  period: string;
  label: string;
  duePaise: number;
  collectedPaise: number;
  collectionRate: number;
  recordCount: number;
}

interface Analytics {
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  occupancyRate: number;
  currentPeriod: string;
  currentCollectionRate: number;
  currentCollectedPaise: number;
  currentDuePaise: number;
  monthlyRevenuePotentialPaise: number;
  trend: PeriodStat[];
  aging: {
    due0to30Paise: number;
    due31to60Paise: number;
    due61to90Paise: number;
    due90PlusPaise: number;
    count0to30: number;
    count31to60: number;
    count61to90: number;
    count90Plus: number;
  };
  totalOutstandingPaise: number;
  defaulterCount: number;
  currentExpensePaise: number;
  currentNetPaise: number;
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'good' | 'warn';
}) {
  const ring =
    tone === 'good'
      ? 'border-[#A7F3D0]'
      : tone === 'warn'
        ? 'border-[#FECACA]'
        : 'border-[#E2E8F0]';
  return (
    <div className={`bg-white border ${ring} rounded-[12px] p-4 shadow-xs`}>
      <div className="flex items-center gap-2 text-[#64748B] mb-2">
        {icon}
        <span className="text-[11px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-bold text-[#09090B] font-mono-numbers">{value}</div>
      {sub && <div className="text-[11px] text-[#64748B] mt-0.5">{sub}</div>}
    </div>
  );
}

export default function AnalyticsPage() {
  const { ownerId } = useOwnerSession();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/analytics');
      if (!res.ok) throw new Error('failed');
      setData(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ownerId) load();
  }, [ownerId, load]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto py-16">
        <EmptyState
          icon={<BarChart3 className="w-6 h-6 text-[#64748B]" />}
          title="Couldn't load analytics"
          description="There was a problem fetching your numbers."
          action={
            <button
              onClick={load}
              className="h-11 px-4 rounded-[8px] bg-[#D97706] text-white text-sm font-semibold"
            >
              Retry
            </button>
          }
        />
      </div>
    );
  }

  if (!data || data.totalBeds === 0) {
    return (
      <div className="max-w-5xl mx-auto py-16">
        <EmptyState
          icon={<BarChart3 className="w-6 h-6 text-[#64748B]" />}
          title="No data to analyze yet"
          description="Set up your beds and add residents to start seeing occupancy and collection trends."
        />
      </div>
    );
  }

  const maxTrend = Math.max(1, ...data.trend.map((t) => t.duePaise));
  const agingRows = [
    { label: '0–30 days', paise: data.aging.due0to30Paise, count: data.aging.count0to30, color: '#F59E0B' },
    { label: '31–60 days', paise: data.aging.due31to60Paise, count: data.aging.count31to60, color: '#F97316' },
    { label: '61–90 days', paise: data.aging.due61to90Paise, count: data.aging.count61to90, color: '#EF4444' },
    { label: '90+ days', paise: data.aging.due90PlusPaise, count: data.aging.count90Plus, color: '#991B1B' },
  ];
  const agingMax = Math.max(1, ...agingRows.map((r) => r.paise));

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-[8px] bg-[#FEF3C7] border border-[#FDE68A] text-[#D97706] flex items-center justify-center shrink-0">
          <BarChart3 className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#09090B]">Business Analytics</h1>
          <p className="text-xs text-[#64748B]">Occupancy, collections and overdue aging for your PG.</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          icon={<TrendingUp className="w-3.5 h-3.5" />}
          label="Collection %"
          value={`${data.currentCollectionRate}%`}
          sub={`${formatCurrency(data.currentCollectedPaise / 100)} of ${formatCurrency(data.currentDuePaise / 100)}`}
          tone={data.currentCollectionRate >= 80 ? 'good' : data.currentCollectionRate < 50 ? 'warn' : 'default'}
        />
        <KpiCard
          icon={<Building2 className="w-3.5 h-3.5" />}
          label="Occupancy"
          value={`${data.occupancyRate}%`}
          sub={`${data.occupiedBeds}/${data.totalBeds} beds · ${data.vacantBeds} vacant`}
          tone={data.occupancyRate >= 85 ? 'good' : 'default'}
        />
        <KpiCard
          icon={<IndianRupee className="w-3.5 h-3.5" />}
          label="Monthly Potential"
          value={formatCurrency(data.monthlyRevenuePotentialPaise / 100)}
          sub="If all beds occupied & paid"
        />
        <KpiCard
          icon={<AlertTriangle className="w-3.5 h-3.5" />}
          label="Outstanding"
          value={formatCurrency(data.totalOutstandingPaise / 100)}
          sub={`${data.defaulterCount} overdue`}
          tone={data.defaulterCount > 0 ? 'warn' : 'good'}
        />
        <KpiCard
          icon={<IndianRupee className="w-3.5 h-3.5" />}
          label="Net This Month"
          value={formatCurrency(data.currentNetPaise / 100)}
          sub={`Collected − ${formatCurrency(data.currentExpensePaise / 100)} expenses`}
          tone={data.currentNetPaise >= 0 ? 'good' : 'warn'}
        />
      </div>

      {/* 6-month collection trend — inline CSS bars (due vs collected) */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-4 sm:p-5 shadow-xs">
        <h2 className="text-sm font-bold text-[#09090B] mb-4">Last 6 Months · Due vs Collected</h2>
        <div className="flex items-end justify-between gap-2 sm:gap-4 h-44">
          {data.trend.map((t) => {
            const dueH = Math.round((t.duePaise / maxTrend) * 100);
            const colH = Math.round((t.collectedPaise / maxTrend) * 100);
            return (
              <div key={t.period} className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                <div className="w-full flex items-end justify-center gap-1 h-36">
                  <div
                    className="w-1/2 max-w-[18px] rounded-t-[3px] bg-[#E2E8F0]"
                    style={{ height: `${dueH}%` }}
                    title={`Due: ${formatCurrency(t.duePaise / 100)}`}
                  />
                  <div
                    className="w-1/2 max-w-[18px] rounded-t-[3px] bg-[#10B981]"
                    style={{ height: `${colH}%` }}
                    title={`Collected: ${formatCurrency(t.collectedPaise / 100)}`}
                  />
                </div>
                <span className="text-[10px] text-[#64748B] font-semibold">{t.label}</span>
                <span className="text-[10px] text-[#94A3B8]">{t.collectionRate}%</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-[11px] text-[#64748B]">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#E2E8F0]" /> Due
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#10B981]" /> Collected
          </span>
        </div>
      </div>

      {/* Defaulter aging buckets */}
      <div className="bg-white border border-[#E2E8F0] rounded-[12px] p-4 sm:p-5 shadow-xs">
        <h2 className="text-sm font-bold text-[#09090B] mb-4">Overdue Aging</h2>
        {data.defaulterCount === 0 ? (
          <p className="text-xs text-[#10B981] font-semibold">No overdue payments — fully collected. 🎉</p>
        ) : (
          <div className="space-y-3">
            {agingRows.map((r) => (
              <div key={r.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-[#334155] font-semibold">
                    {r.label} <span className="text-[#94A3B8] font-normal">· {r.count}</span>
                  </span>
                  <span className="font-mono-numbers text-[#09090B]">{formatCurrency(r.paise / 100)}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#F1F5F9] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.round((r.paise / agingMax) * 100)}%`, backgroundColor: r.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
