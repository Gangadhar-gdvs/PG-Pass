import { Skeleton } from '@/components/ui/skeleton';
import { StatGridSkeleton, ListSkeleton } from '@/components/ui/skeletons';

/**
 * Route-level loading UI for the whole owner area.
 *
 * WHY THIS EXISTS: without a `loading.tsx`, the App Router keeps the PREVIOUS
 * page on screen while it fetches the next route's RSC payload — so tapping a
 * bottom-tab highlighted the new tab instantly but the content lingered on the
 * old page for a beat, then "jumped". This file adds a Suspense boundary: the
 * instant you navigate, the content area swaps to this skeleton (the shell —
 * tab bar + top bar — stays mounted), then the real page streams in. No more
 * "shows the previous page for a few seconds" / "tab moved but page didn't".
 *
 * Shape is a neutral page scaffold (sticky header bar + a stat row + a list)
 * that reads as "this page is loading" for every owner page without matching
 * any single one exactly.
 */
export default function OwnerAreaLoading() {
  return (
    <div className="space-y-5" aria-busy="true">
      <span className="sr-only">Loading…</span>
      {/* Header bar (mirrors the sticky PageHeader shape) */}
      <div className="flex items-center gap-3 rounded-[22px] border border-white/90 glass-bar px-3 py-2.5 sm:px-4 sm:py-3">
        <Skeleton className="h-11 w-11 rounded-2xl sm:h-12 sm:w-12" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56 rounded-full" />
        </div>
      </div>
      <StatGridSkeleton count={4} />
      <ListSkeleton rows={4} />
    </div>
  );
}
