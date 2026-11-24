import { Skeleton, HeaderSkeleton, StatsSkeleton, ListSkeleton } from "@/components/ui/Skeleton";

// Overview placeholder while its data loads: header, the navy hero band,
// the stat strip and a list — the same shape as the real page.
export default function DashboardLoading() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <HeaderSkeleton />
      <Skeleton className="h-72 w-full rounded-xl md:h-80" />
      <div className="mt-6">
        <StatsSkeleton />
      </div>
      <div className="mt-6">
        <ListSkeleton rows={4} />
      </div>
    </div>
  );
}
