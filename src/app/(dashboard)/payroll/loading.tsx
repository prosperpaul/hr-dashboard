import { HeaderSkeleton, ListSkeleton, Skeleton } from "@/components/ui/Skeleton";

// Shown instantly while this page's data loads (Next.js swaps in the real
// page when it's ready). Shaped like the payroll page: header, the navy
// pay-cycle block, the progress strip, then the staff list — so nothing jumps.
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading…</span>
      <HeaderSkeleton />
      <Skeleton className="h-48 rounded-xl md:h-40" />
      <Skeleton className="h-36 rounded-xl sm:h-20" />
      <ListSkeleton rows={6} />
    </div>
  );
}
