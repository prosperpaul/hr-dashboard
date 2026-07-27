"use client";

import { useState, useTransition } from "react";
import { Award, CheckCircle2 } from "lucide-react";
import { ratingLabel, type ReviewRow } from "@/lib/performance";
import { acknowledgeReview } from "@/lib/performance-actions";
import Stars from "./Stars";

export default function MyReviews({ initialReviews }: { initialReviews: ReviewRow[] }) {
  const [list, setList] = useState<ReviewRow[]>(initialReviews);
  const [isPending, startTransition] = useTransition();

  function handleAcknowledge(review: ReviewRow) {
    startTransition(async () => {
      try {
        await acknowledgeReview(review.id);
        setList((prev) => prev.map((r) => (r.id === review.id ? { ...r, status: "Acknowledged" } : r)));
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Could not acknowledge the review.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">My reviews</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {isPending ? "Working…" : "Your performance reviews"}
        </p>
      </div>

      {list.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-surface py-16 text-center">
          <div className="max-w-sm">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-surface-2">
              <Award className="h-5 w-5 text-ink-faint" />
            </div>
            <p className="mt-3 text-sm font-medium text-ink">No reviews yet</p>
            <p className="mt-1 text-sm text-ink-muted">
              When your manager shares a review, it&apos;ll appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {list.map((r) => (
            <div key={r.id} className="flex flex-col rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-ink">{r.period}</p>
                  <p className="text-xs text-ink-muted">Reviewed by {r.reviewerName}</p>
                </div>
                {r.status === "Acknowledged" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-good/15 px-2 py-0.5 text-xs font-medium text-good ring-1 ring-good/40">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Acknowledged
                  </span>
                ) : (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent ring-1 ring-accent/40">
                    Submitted
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Stars rating={r.rating} />
                <span className="text-sm text-ink-muted">{ratingLabel(r.rating)}</span>
              </div>

              {r.strengths && (
                <div className="mt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">Strengths</p>
                  <p className="mt-1 text-sm text-ink-muted">{r.strengths}</p>
                </div>
              )}
              {r.goals && (
                <div className="mt-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">Goals</p>
                  <p className="mt-1 text-sm text-ink-muted">{r.goals}</p>
                </div>
              )}

              {r.status === "Submitted" && (
                <div className="mt-5 border-t border-border pt-4">
                  <button
                    onClick={() => handleAcknowledge(r)}
                    disabled={isPending}
                    className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Acknowledge review
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
