// Shown INSTANTLY while any dashboard page fetches its data from the database.
// Next.js swaps this out for the real page as soon as it's ready, so tapping a
// nav link feels immediate instead of frozen.
export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Title */}
      <div>
        <div className="h-7 w-48 rounded-md bg-surface-2" />
        <div className="mt-2 h-4 w-64 rounded bg-surface-2/70" />
      </div>

      {/* Stat/card row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl border border-border bg-surface" />
        ))}
      </div>

      {/* Table / content block */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="border-b border-border p-4">
          <div className="h-5 w-40 rounded bg-surface-2" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-4">
              <div className="h-9 w-9 shrink-0 rounded-full bg-surface-2" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-1/3 rounded bg-surface-2" />
                <div className="h-3 w-1/4 rounded bg-surface-2/70" />
              </div>
              <div className="hidden h-3.5 w-16 rounded bg-surface-2 sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
