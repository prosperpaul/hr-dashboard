import { HeaderSkeleton, ListSkeleton, Skeleton } from "@/components/ui/Skeleton";

// Shown instantly while this page's data loads (Next.js swaps in the real
// page when it's ready). Shaped like the page:
//  • phones & tablets: header, the Requests | Calendar switch, status chips,
//    then a stack of request cards;
//  • desktop (lg+): header, the row of view tabs, then the timeline card
//    next to the approvals rail.
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading…</span>
      <HeaderSkeleton />

      <div className="space-y-3 lg:hidden">
        <Skeleton className="h-14 w-full rounded-full" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-28 shrink-0 rounded-full" />
          ))}
        </div>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-64 w-full rounded-xl" />
        ))}
      </div>

      <div className="hidden space-y-6 lg:block">
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
          <div className="min-w-0 xl:col-span-8">
            <ListSkeleton rows={6} />
          </div>
          <Skeleton className="h-72 xl:col-span-4" />
        </div>
      </div>
    </div>
  );
}
