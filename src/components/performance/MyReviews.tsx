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
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-label-sm uppercase tracking-wider text-ink-faint">
          <span>Operations</span>
          <span>/</span>
          <span className="normal-case tracking-normal text-ink-muted">Performance</span>
        </div>
        <h1 className="text-headline-lg text-ink md:text-headline-xl">My reviews</h1>
        <p className="text-body-md text-ink-muted">
          {isPending ? "Working…" : "Your performance reviews"}
        </p>
      </div>

      {list.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-border bg-surface py-16 text-center">
          <div className="max-w-sm">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface-2">
              <Award className="h-5 w-5 text-ink-faint" />
            </div>
            <p className="mt-3 text-headline-sm text-ink">No reviews yet</p>
            <p className="mt-1 text-body-md text-ink-muted">
              When your manager shares a review, it&apos;ll appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {list.map((r) => (
            <div key={r.id} className="flex flex-col rounded-xl border border-border bg-surface p-5 transition-colors duration-150 hover:border-border-strong">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-headline-md text-ink">{r.period}</p>
                  <p className="text-body-sm text-ink-faint">Reviewed by {r.reviewerName}</p>
                </div>
                {r.status === "Acknowledged" ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-accent/25 bg-accent-soft px-2 py-0.5 text-label-sm text-accent-hover">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Acknowledged
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-400/30 bg-sky-400/10 px-2 py-0.5 text-label-sm text-sky-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
                    Shared with you
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Stars rating={r.rating} />
                <span className="text-body-md text-ink-muted">
                  <span className="tnum text-ink">{r.rating}/5</span> · {ratingLabel(r.rating)}
                </span>
              </div>

              {r.strengths && (
                <div className="mt-4">
                  <p className="text-label-sm uppercase tracking-wider text-ink-faint">Strengths</p>
                  <p className="mt-1 text-body-md text-ink-muted">{r.strengths}</p>
                </div>
              )}
              {r.goals && (
                <div className="mt-3">
                  <p className="text-label-sm uppercase tracking-wider text-ink-faint">Goals</p>
                  <p className="mt-1 text-body-md text-ink-muted">{r.goals}</p>
                </div>
              )}

              {r.status === "Submitted" && (
                <div className="mt-5 border-t border-border pt-4">
                  <button
                    onClick={() => handleAcknowledge(r)}
                    disabled={isPending}
                    className="flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-label-md font-semibold text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] transition-colors hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-60"
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
