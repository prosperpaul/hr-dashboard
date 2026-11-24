"use client";

import { useState, useTransition } from "react";
import { Award, CheckCircle2, Send } from "lucide-react";
import { ratingLabel, type ReviewRow } from "@/lib/performance";
import { acknowledgeReview } from "@/lib/performance-actions";
import Stars from "./Stars";
import Avatar from "./Avatar";
import EmptyState from "@/components/ui/EmptyState";
import StatusText from "@/components/ui/StatusText";
import { buttonClass } from "@/components/ui/button";

/*
  Self-service view: the reviews your manager has SHARED with you
  (drafts are never sent here). You can acknowledge a shared review.
*/
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

  // Headline figures from your own reviews.
  const waiting = list.filter((r) => r.status === "Submitted").length;
  const latest = list[0]; // the server sends newest first
  const average = list.length ? list.reduce((s, r) => s + r.rating, 0) / list.length : 0;

  const headline =
    list.length === 0
      ? "No reviews yet."
      : waiting > 0
        ? `${waiting} ${waiting === 1 ? "review is" : "reviews are"} waiting for you.`
        : "You're all caught up.";

  return (
    <div className="space-y-6">
      <section className="space-y-2 border-b border-border pb-6">
        <p className="flex flex-wrap items-center gap-2 text-eyebrow uppercase text-ink-muted">
          <span>Performance</span>
          <span className="h-1 w-1 rounded-full bg-accent" />
          <span>My reviews</span>
        </p>
        <h1 className="text-headline-lg text-ink [overflow-wrap:anywhere] md:text-headline-xl">{headline}</h1>
        <p className="max-w-2xl text-body-md text-ink-muted">
          {isPending ? "Working…" : "Reviews your manager has shared with you. Read them, then acknowledge to confirm you've seen them."}
        </p>
        {list.length > 0 && (
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-body-sm text-ink-muted">
            <li>
              <span className="tnum font-bold text-ink">{list.length}</span> {list.length === 1 ? "review" : "reviews"}
            </li>
            <li className="flex items-center gap-1.5">
              <span className="mr-1.5 text-border-strong">/</span>
              <span className="tnum font-bold text-ink">{average.toFixed(1)}</span> average rating
            </li>
            {latest && (
              <li className="flex items-center gap-1.5">
                <span className="mr-1.5 text-border-strong">/</span>
                latest <span className="font-bold text-ink">{latest.period}</span>
              </li>
            )}
          </ul>
        )}
      </section>

      {list.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState icon={Award} title="No reviews yet" description="When your manager shares a review, it'll appear here." />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {list.map((r) => (
            <article
              key={r.id}
              className={`flex min-w-0 flex-col rounded-xl border bg-surface p-4 sm:p-5 ${r.status === "Submitted" ? "border-accent" : "border-border"}`}
            >
              <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
                <div className="min-w-0">
                  <p className="text-eyebrow uppercase text-ink-muted">Review cycle</p>
                  <p className="text-headline-md text-ink">{r.period}</p>
                  <p className="mt-1 flex min-w-0 items-center gap-2 text-body-sm text-ink-muted">
                    <Avatar name={r.reviewerName} department={null} size={22} />
                    <span className="truncate">Reviewed by {r.reviewerName}</span>
                  </p>
                </div>
                {/* Status as icon + words (never colour alone). */}
                {r.status === "Acknowledged" ? (
                  <StatusText tone="good" variant="pill" className="shrink-0 text-label-sm">
                    Acknowledged
                  </StatusText>
                ) : (
                  <StatusText tone="pending" icon={Send} variant="pill" className="shrink-0 text-label-sm">
                    Shared with you
                  </StatusText>
                )}
              </div>

              <div className="mt-4 flex items-center gap-3">
                <span className="tnum text-metric-md text-ink">{r.rating}.0</span>
                <div>
                  <Stars rating={r.rating} />
                  <p className="text-body-sm text-ink-muted">{ratingLabel(r.rating)}</p>
                </div>
              </div>

              {r.strengths && (
                <div className="mt-4">
                  <p className="text-eyebrow uppercase text-ink-muted">Strengths</p>
                  <p className="mt-1 text-body-md italic text-ink [overflow-wrap:anywhere]">&ldquo;{r.strengths}&rdquo;</p>
                </div>
              )}
              {r.goals && (
                <div className="mt-3">
                  <p className="text-eyebrow uppercase text-ink-muted">Goals</p>
                  <p className="mt-1 text-body-md text-ink-muted [overflow-wrap:anywhere]">{r.goals}</p>
                </div>
              )}

              {r.status === "Submitted" && (
                <div className="mt-5 border-t border-border pt-4">
                  <button
                    onClick={() => handleAcknowledge(r)}
                    disabled={isPending}
                    className={`${buttonClass("primary")} w-full sm:w-auto`}
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    Acknowledge review
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
