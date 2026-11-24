import { PageSkeleton } from "@/components/ui/Skeleton";

// Shown instantly while this page's data loads (Next.js swaps in the real
// page when it's ready). Shaped like the page so nothing jumps.
export default function Loading() {
  return <PageSkeleton stats={0} rows={3} />;
}
