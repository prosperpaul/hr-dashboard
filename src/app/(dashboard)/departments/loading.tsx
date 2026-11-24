import { HeaderSkeleton, Skeleton } from "@/components/ui/Skeleton";

// Shown instantly while this page's data loads (Next.js swaps in the real
// page when it's ready). Shaped like the page — header, metrics band, then
// department cards (one column on phones, more on wider screens).
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading…</span>
      <HeaderSkeleton />
      <Skeleton className="h-36 md:h-20" />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-80" />
        ))}
      </div>
    </div>
  );
}
