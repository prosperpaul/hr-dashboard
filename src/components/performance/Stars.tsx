import { Star } from "lucide-react";

// Read-only 1..5 star display (filled butter-yellow stars with a gold outline).
// role="img" + aria-label means screen readers say "4 out of 5" once,
// instead of announcing five separate icons. `small` = 14px stars for list rows.
export default function Stars({ rating, small = false }: { rating: number; small?: boolean }) {
  const size = small ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <span role="img" className="inline-flex shrink-0 items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} aria-hidden className={`${size} ${n <= rating ? "fill-accent text-accent-ink" : "text-border-strong"}`} />
      ))}
    </span>
  );
}
