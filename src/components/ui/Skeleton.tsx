/*
  Skeletons — grey placeholder shapes shown while a page loads, laid out
  like the real page so nothing jumps when the data arrives.
  The whole group is announced once as "Loading…" (role="status"); the
  shapes themselves are hidden from screen readers.
*/
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-[skeleton-pulse_1.4s_ease-in-out_infinite] rounded-lg bg-surface-2 ${className}`} />;
}

/** Page header placeholder: eyebrow, title, sentence. */
export function HeaderSkeleton() {
  return (
    <div className="mb-6 space-y-3 md:mb-8">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-9 w-3/4 max-w-md" />
      <Skeleton className="h-4 w-full max-w-lg" />
    </div>
  );
}

/** A strip of stat cards. */
export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="-mx-gutter flex gap-3 overflow-hidden px-gutter md:mx-0 md:grid md:grid-cols-2 md:px-0 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} className="h-28 w-[70%] shrink-0 md:w-auto" />
      ))}
    </div>
  );
}

/** A list of rows (avatar + two lines + meta). */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border rounded-xl border border-border bg-surface px-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex min-h-tap items-center gap-3 py-3">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-14" />
        </div>
      ))}
    </div>
  );
}

/** The standard page: header, stats, then a list. Used by most loading.tsx files. */
export function PageSkeleton({ stats = 4, rows = 6 }: { stats?: number; rows?: number }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <HeaderSkeleton />
      {stats > 0 && <StatsSkeleton count={stats} />}
      <div className="mt-6">
        <ListSkeleton rows={rows} />
      </div>
    </div>
  );
}
