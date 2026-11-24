import { Skeleton } from "@/components/ui/Skeleton";

// Shown instantly while this page's data loads (Next.js swaps in the real
// page when it's ready). Shaped like the profile: back link, navy hero,
// a 2-across numbers strip, then the cards (one column on phones).
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-5 w-48" />
      <div aria-hidden className="rounded-xl bg-navy p-4 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row">
          <div className="size-24 shrink-0 rounded-xl bg-navy-2 md:size-28" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="h-5 w-32 rounded-full bg-navy-2" />
            <div className="h-9 w-3/4 max-w-sm rounded-lg bg-navy-2" />
            <div className="h-4 w-1/2 max-w-xs rounded-lg bg-navy-2" />
          </div>
        </div>
        <div className="mt-6 flex gap-2 lg:hidden">
          <div className="h-12 flex-1 rounded-full bg-navy-2" />
          <div className="h-12 flex-1 rounded-full bg-navy-2" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
