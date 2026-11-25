import * as React from 'react';
import { Skeleton } from './skeleton';

/**
 * Reusable, content-shaped skeleton loaders.
 *
 * These mirror the REAL layout of each page/section (a stat-card row looks like
 * the stat cards, a list row looks like a list row) so the loading state matches
 * the data that replaces it — no generic spinners, no per-page duplicated
 * markup. Compose the small pieces, or use a ready-made PageSkeleton.
 */

/** A single "bento" stat card placeholder (matches StatsBar cards). */
export function StatCardSkeleton() {
  return (
    <div className="app-card p-4.5 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-10 rounded-full" />
      </div>
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  );
}

/** A row of N stat cards (default 4), matching the dashboard/analytics HUD. */
export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** A page header placeholder (title + subtitle, optional action button). */
export function HeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
      <div className="space-y-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-3 w-56" />
      </div>
      {action && <Skeleton className="h-9 w-28 rounded-full" />}
    </div>
  );
}

/**
 * A list/table placeholder: avatar + two text lines + a trailing value, matching
 * the resident/guest/tenant rows. `rows` controls how many.
 */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-[12px] border border-[#E2E8F0] bg-white divide-y divide-[#E2E8F0]">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3.5">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-4 w-16 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** A grid of card placeholders (maintenance tickets, discovery results, etc.). */
export function CardListSkeleton({
  rows = 4,
  height = 'h-24',
  cols = 1,
}: {
  rows?: number;
  height?: string;
  cols?: 1 | 2 | 3;
}) {
  const colClass = cols === 3 ? 'sm:grid-cols-3' : cols === 2 ? 'sm:grid-cols-2' : '';
  return (
    <div className={`grid grid-cols-1 ${colClass} gap-3`}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={`${height} rounded-[12px]`} />
      ))}
    </div>
  );
}

/** A tall chart/panel placeholder. */
export function PanelSkeleton({ height = 'h-64' }: { height?: string }) {
  return <Skeleton className={`${height} w-full rounded-[12px]`} />;
}

/**
 * A full dashboard-shaped skeleton: header + stat grid + filter bar + bed grid.
 * Matches the owner dashboard so the transition to real data is seamless.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <HeaderSkeleton />
      <StatGridSkeleton count={4} />
      <Skeleton className="h-14 w-full rounded-[12px]" />
      <CardListSkeleton rows={6} height="h-28" cols={3} />
    </div>
  );
}

/** A form-shaped skeleton (settings, billing): stacked labelled fields. */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="rounded-[12px] border border-[#E2E8F0] bg-white p-5 space-y-5">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-10 w-full rounded-[8px]" />
        </div>
      ))}
      <Skeleton className="h-11 w-32 rounded-full" />
    </div>
  );
}
