'use client';

import React, { useState, useEffect } from 'react';
import { useOwnerSession } from '@/hooks/useOwner';
import { formatCurrency } from '@/lib/utils';
import { StatGridSkeleton, PanelSkeleton } from '@/components/ui/skeletons';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader, SectionCard, InfoBanner } from '@/components/ui/dashboard-kit';
import { Icon3D, type Icon3DName, type Tint } from '@/components/brand/Icon3D';
import { RotateCw } from 'lucide-react';

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
  degraded?: { aging?: boolean; expenses?: boolean };
}

type KpiTone = 'default' | 'good' | 'warn';

/**
 * KPI tile — same anatomy as the kit's StatTile (pastel tint card, 3D icon,
 * big number, label) plus the supporting sub-line these analytics need. The
 * tone re-tints the tile (mint = healthy, rose = needs attention) and adds a
 * corner dot with screen-reader text so status is never colour-only.
 */
function KpiTile({
  icon,
  tint,
  label,
  value,
  sub,
  tone = 'default',
  wide = false,
}: {
  icon: Icon3DName;
  tint: Tint;
  label: string;
  value: string;
  sub?: string;
  tone?: KpiTone;
  wide?: boolean;
}) {
  const t: Tint = tone === 'good' ? 'mint' : tone === 'warn' ? 'rose' : tint;
  const status =
    tone === 'default' ? null : (
      <>
        <span
          aria-hidden="true"
          className={`absolute right-3 top-3 h-2 w-2 rounded-full ring-2 ring-white/80 ${
            tone === 'good' ? 'bg-success' : 'bg-danger'
          }`}
        />
        <span className="sr-only">{tone === 'good' ? 'On track' : 'Needs attention'}</span>
      </>
    );

  if (wide) {
    return (
      <div className={`tint-card tint-${t} relative flex h-full items-center gap-3.5 px-4 py-3.5 sm:px-5`}>
        {status}
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]">
          <Icon3D name={icon} size={36} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-bold text-ink-2">{label}</div>
          {sub && <div className="line-clamp-2 text-[12px] font-medium leading-snug text-muted">{sub}</div>}
        </div>
        <div className="shrink-0 pr-2 text-right font-mono-numbers text-[20px] font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-[24px]">
          {value}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`tint-card tint-${t} relative flex h-full flex-col items-center justify-center gap-1 px-2.5 pt-3.5 pb-3 text-center`}
    >
      {status}
      <span className="grid h-11 place-items-center">
        <Icon3D name={icon} size={40} />
      </span>
      <span className="mt-0.5 font-mono-numbers text-[19px] font-extrabold leading-tight tracking-[-0.02em] text-ink sm:text-[22px]">
        {value}
      </span>
      <span className="text-[11.5px] font-semibold leading-tight text-ink-2 sm:text-xs">{label}</span>
      {sub && <span className="text-[11px] font-medium leading-snug text-muted">{sub}</span>}
    </div>
  );
}

function AnalyticsHeader() {
  return (
    <PageHeader
      icon="chart"
      tint="violet"
      title="Business"
      highlight="Analytics"
      subtitle="Occupancy, collections and overdue aging for your PG."
    />
  );
}

export default function AnalyticsPage() {
  const { ownerId } = useOwnerSession();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // A support-friendly reference for the failure (server requestId) so the owner
  // can quote it to support and the admin can find it in the system log viewer.
  const [errorRef, setErrorRef] = useState<string | null>(null);
  // True when the failure is specifically "the admin hasn't enabled Analytics
  // for this PG" — shown as an informative notice rather than a generic error.
  const [featureDisabled, setFeatureDisabled] = useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(false);
    setErrorRef(null);
    setFeatureDisabled(false);
    try {
      const res = await fetch('/api/analytics');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 403 && body?.code === 'FEATURE_DISABLED') {
          setFeatureDisabled(true);
          return;
        }
        // Capture the server requestId (set by withErrorHandler) so the generic
        // user-facing message can still point support at the exact logged error.
        setErrorRef(body?.requestId || res.headers.get('X-Request-Id') || null);
        throw new Error(body?.error || 'failed');
      }
      setData(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ownerId) return;
    // Defer so load()'s synchronous setLoading/setError run after this effect
    // commits rather than inside its body (cascading-render lint rule). Initial
    // state already shows the skeleton, so there's no visible delay.
    let active = true;
    queueMicrotask(() => {
      if (active) load();
    });
    return () => {
      active = false;
    };
  }, [ownerId, load]);

  if (loading) {
    // Real header during load so its shape doesn't change when data arrives.
    return (
      <div className="max-w-5xl mx-auto space-y-5">
        <AnalyticsHeader />
        <StatGridSkeleton count={4} />
        <PanelSkeleton height="h-64" />
      </div>
    );
  }

  if (featureDisabled) {
    return (
      <div className="max-w-5xl mx-auto space-y-5">
        <AnalyticsHeader />
        <div className="app-card animate-fade-up">
          <EmptyState
            icon3d="chart"
            className="py-14"
            title="Analytics isn't enabled for your PG"
            description="The Analytics module is managed by the PGPass team for your plan. Contact support to have it enabled for your account."
          />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto space-y-5">
        <AnalyticsHeader />
        <div className="app-card animate-fade-up">
          <EmptyState
            icon3d="alert"
            className="py-14"
            title="Couldn't load analytics"
            description={
              errorRef
                ? `We couldn't fetch your numbers right now. Please retry — if it keeps happening, contact support with reference ${errorRef}.`
                : "We couldn't fetch your numbers right now. Please retry in a moment."
            }
            action={
              <Button onClick={load}>
                <RotateCw className="h-4 w-4" />
                Retry
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  if (!data || data.totalBeds === 0) {
    return (
      <div className="max-w-5xl mx-auto space-y-5">
        <AnalyticsHeader />
        <div className="app-card animate-fade-up">
          <EmptyState
            illustration="clipboard"
            className="py-14"
            title="No data to analyze yet"
            description="Set up your beds and add residents to start seeing occupancy and collection trends."
          />
        </div>
      </div>
    );
  }

  const maxTrend = Math.max(1, ...data.trend.map((t) => t.duePaise));
  // Overdue buckets warm from orange (recent) to deep rose (90+ days).
  const agingRows = [
    {
      label: '0–30 days',
      paise: data.aging.due0to30Paise,
      count: data.aging.count0to30,
      badge: 'pending' as const,
      bar: 'bg-[linear-gradient(90deg,#FFC08F_0%,#F2791C_100%)]',
    },
    {
      label: '31–60 days',
      paise: data.aging.due31to60Paise,
      count: data.aging.count31to60,
      badge: 'pending' as const,
      bar: 'bg-[linear-gradient(90deg,#F99A52_0%,#DB6612_100%)]',
    },
    {
      label: '61–90 days',
      paise: data.aging.due61to90Paise,
      count: data.aging.count61to90,
      badge: 'danger' as const,
      bar: 'bg-[linear-gradient(90deg,#FF8FA3_0%,#E5484D_100%)]',
    },
    {
      label: '90+ days',
      paise: data.aging.due90PlusPaise,
      count: data.aging.count90Plus,
      badge: 'danger' as const,
      bar: 'bg-[linear-gradient(90deg,#EE5873_0%,#B42335_100%)]',
    },
  ];
  const agingMax = Math.max(1, ...agingRows.map((r) => r.paise));

  // Which sub-reports failed (shown as ₹0) — same wording as before, split into
  // the banner's title/description.
  const degradedParts = data.degraded
    ? [data.degraded.aging && 'Overdue / outstanding', data.degraded.expenses && 'expenses'].filter(Boolean).join(' and ')
    : '';

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <AnalyticsHeader />

      {/* Honest partial-failure notice: when a sub-report fails to load we show
          zeros for it, so warn the owner rather than imply "0 overdue / full net"
          is a healthy state. */}
      {data.degraded && (
        <InfoBanner
          tone="warning"
          className="animate-pop"
          title="Some figures couldn't be calculated just now"
          description={`${degradedParts ? `${degradedParts.charAt(0).toUpperCase()}${degradedParts.slice(1)} are shown as ₹0. ` : ''}Please retry shortly.`}
        />
      )}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
        <KpiTile
          icon="wallet"
          tint="violet"
          label="Collection %"
          value={`${data.currentCollectionRate}%`}
          sub={`${formatCurrency(data.currentCollectedPaise / 100)} of ${formatCurrency(data.currentDuePaise / 100)}`}
          tone={data.currentCollectionRate >= 80 ? 'good' : data.currentCollectionRate < 50 ? 'warn' : 'default'}
        />
        <KpiTile
          icon="bed"
          tint="sky"
          label="Occupancy"
          value={`${data.occupancyRate}%`}
          sub={`${data.occupiedBeds}/${data.totalBeds} beds · ${data.vacantBeds} vacant`}
          tone={data.occupancyRate >= 85 ? 'good' : 'default'}
        />
        <KpiTile
          icon="rupee"
          tint="indigo"
          label="Monthly Potential"
          value={formatCurrency(data.monthlyRevenuePotentialPaise / 100)}
          sub="If all beds occupied & paid"
        />
        <KpiTile
          icon="alert"
          tint="peach"
          label="Outstanding"
          value={formatCurrency(data.totalOutstandingPaise / 100)}
          sub={`${data.defaulterCount} overdue`}
          tone={data.defaulterCount > 0 ? 'warn' : 'good'}
        />
        <div className="col-span-2 lg:col-span-4">
          <KpiTile
            wide
            icon="rupee-badge"
            tint="violet"
            label="Net This Month"
            value={formatCurrency(data.currentNetPaise / 100)}
            sub={`Collected − ${formatCurrency(data.currentExpensePaise / 100)} expenses`}
            tone={data.currentNetPaise >= 0 ? 'good' : 'warn'}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-5">
        {/* 6-month collection trend — inline CSS bars (due vs collected) */}
        <SectionCard
          title="Due vs Collected"
          icon="chart"
          action={<span className="chip shrink-0">Last 6 Months</span>}
        >
          <div className="flex items-end justify-between gap-2 sm:gap-4 border-b border-line pb-0.5">
            {data.trend.map((t) => {
              const dueH = Math.round((t.duePaise / maxTrend) * 100);
              const colH = Math.round((t.collectedPaise / maxTrend) * 100);
              return (
                <div key={t.period} className="flex-1 min-w-0">
                  <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-40">
                    <div
                      className="w-1/2 max-w-[18px] rounded-t-full rounded-b-md bg-brand-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                      style={{ height: `${dueH}%` }}
                      title={`Due: ${formatCurrency(t.duePaise / 100)}`}
                    />
                    <div
                      className="w-1/2 max-w-[18px] rounded-t-full rounded-b-md bg-[image:var(--grad-brand)] shadow-[0_8px_14px_-8px_rgba(106,43,234,0.7),inset_0_1px_0_rgba(255,255,255,0.35)]"
                      style={{ height: `${colH}%` }}
                      title={`Collected: ${formatCurrency(t.collectedPaise / 100)}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-start justify-between gap-2 sm:gap-4">
            {data.trend.map((t) => (
              <div key={t.period} className="flex-1 min-w-0 flex flex-col items-center gap-0.5 text-center">
                <span className="truncate text-[11px] font-bold text-ink-2">{t.label}</span>
                <span className="font-mono-numbers text-[10.5px] font-semibold text-muted">{t.collectionRate}%</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-lilac px-3 py-1.5 text-xs font-semibold text-ink-2">
              <span className="h-2.5 w-2.5 rounded-full bg-brand-200" /> Due
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-lilac px-3 py-1.5 text-xs font-semibold text-ink-2">
              <span className="h-2.5 w-2.5 rounded-full bg-[image:var(--grad-brand)]" /> Collected
            </span>
          </div>
        </SectionCard>

        {/* Defaulter aging buckets */}
        <SectionCard
          title="Overdue Aging"
          icon="calendar-clock"
          action={
            data.defaulterCount > 0 ? (
              <Badge variant="danger" dot className="shrink-0">
                {data.defaulterCount} overdue
              </Badge>
            ) : undefined
          }
        >
          {data.defaulterCount === 0 ? (
            <div className="well flex items-center gap-3 p-3.5">
              <Icon3D name="check" size={36} />
              <p className="text-[13.5px] font-bold text-success-ink">No overdue payments — fully collected. 🎉</p>
            </div>
          ) : (
            <div className="divide-y divide-line">
              {agingRows.map((r) => (
                <div key={r.label} className="py-3 first:pt-0 last:pb-0">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-[13.5px] font-bold text-ink">
                      <span className="truncate">{r.label}</span>
                      <Badge variant={r.badge}>{r.count}</Badge>
                    </span>
                    <span className="shrink-0 font-mono-numbers text-[14px] font-extrabold text-ink">
                      {formatCurrency(r.paise / 100)}
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-lilac-2 shadow-[inset_0_1px_2px_rgba(70,40,160,0.12)]">
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 ${r.bar}`}
                      style={{ width: `${Math.round((r.paise / agingMax) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
