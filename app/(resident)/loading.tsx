import { Skeleton } from '@/components/ui/skeleton';
import { CardListSkeleton } from '@/components/ui/skeletons';

/**
 * Route-level loading UI for the resident area — a Suspense boundary so tab /
 * link navigation swaps the content to a skeleton immediately instead of
 * lingering on the previous page while the next route's RSC loads. The resident
 * shell (top bar + bottom tabs) stays mounted. See app/(owner)/loading.tsx for
 * the full rationale.
 */
export default function ResidentAreaLoading() {
  return (
    <div className="space-y-5 pt-2" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2.5 pt-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-40 rounded-full" />
        </div>
        <Skeleton className="h-28 w-36 rounded-[28px]" />
      </div>
      <CardListSkeleton rows={3} height="h-[84px]" />
    </div>
  );
}
