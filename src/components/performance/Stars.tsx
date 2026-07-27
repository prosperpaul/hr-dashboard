import { Star } from "lucide-react";

// Read-only 1..5 star display.
export default function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-4 w-4 ${n <= rating ? "fill-warning text-warning" : "text-ink-faint"}`}
        />
      ))}
    </span>
  );
}
