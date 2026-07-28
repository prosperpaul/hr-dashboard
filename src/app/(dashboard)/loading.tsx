import { Loader2 } from "lucide-react";

// Shown INSTANTLY while any dashboard page fetches its data from the database.
// Next.js swaps this for the real page as soon as it's ready. Kept deliberately
// obvious (a visible accent spinner) so it never looks like a blank screen.
export default function DashboardLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-accent" />
      <p className="text-sm text-ink-muted">Loading…</p>
    </div>
  );
}
