import * as React from 'react';
import { Skeleton } from './skeleton';

/**
 * Reusable, content-shaped skeleton loaders in the lavender glass style.
 * They mirror the real layout (stat tiles, section cards, list rows) so the
 * loading state matches the data that replaces it.
 */

/** A single pastel stat-tile placeholder (matches StatTile). */
export function StatCardSkeleton() {
  return (
    <div className="app-card p-4 flex flex-col items-center gap-2.5">
      <Skeleton className="h-10 w-10 rounded-2xl" />
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-3 w-20 rounded-full" />
    </div>
  );
}

/** A row of N stat tiles (default 4), matching the dashboard stat row. */
export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** A page header placeholder (icon tile + title + subtitle, optional action). */
export function HeaderSkeleton({ action = true }: { action?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 pb-1">
      <div className="flex items-center gap-3">
        <Skeleton className="h-13 w-13 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56 rounded-full" />
        </div>
      </div>
      {action && <Skeleton className="h-11 w-32 rounded-full" />}
    </div>
  );
}

/**
 * A list placeholder: icon bubble + two text lines + a trailing value, inside
 * a glass section card. `rows` controls how many.
 */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="app-card p-2 divide-y divide-line">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3.5">
          <Skeleton className="h-11 w-11 rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2 rounded-full" />
          </div>
          <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
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
        <Skeleton key={i} className={`${height} rounded-[22px]`} />
      ))}
    </div>
  );
}

/** A tall chart/panel placeholder. */
export function PanelSkeleton({ height = 'h-64' }: { height?: string }) {
  return <Skeleton className={`${height} w-full rounded-[22px]`} />;
}

/**
 * A full dashboard-shaped skeleton: hero band + stat row + section card + grid.
 * Matches the owner dashboard so the transition to real data is seamless.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-40 w-full rounded-[24px]" />
      <StatGridSkeleton count={4} />
      <Skeleton className="h-16 w-full rounded-[22px]" />
      <CardListSkeleton rows={6} height="h-28" cols={3} />
    </div>
  );
}

/** A form-shaped skeleton (settings, billing): stacked labelled fields. */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <div className="app-card p-5 space-y-5">
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-28 rounded-full" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      ))}
      <Skeleton className="h-12 w-36 rounded-full" />
    </div>
  );
}
