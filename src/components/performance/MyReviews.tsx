"use client";

import { useState, useTransition } from "react";
import { Award, CheckCircle2 } from "lucide-react";
import { ratingLabel, type ReviewRow } from "@/lib/performance";
import { acknowledgeReview } from "@/lib/performance-actions";
import Stars from "./Stars";
import Avatar from "./Avatar";

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
        <p className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">
          <span>Performance</span>
          <span className="h-1 w-1 rounded-full bg-accent" />
          <span>My reviews</span>
        </p>
        <h1 className="text-headline-lg text-ink md:text-headline-xl">{headline}</h1>
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
        <div className="grid place-items-center rounded-xl border border-border bg-surface py-16 text-center">
          <div className="max-w-sm">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-accent-soft">
              <Award className="h-5 w-5 text-accent-ink" />
            </div>
            <p className="mt-3 text-headline-sm text-ink">No reviews yet</p>
            <p className="mt-1 text-body-md text-ink-muted">When your manager shares a review, it&apos;ll appear here.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {list.map((r) => (
            <article
              key={r.id}
              className={`flex flex-col rounded-xl border bg-surface p-5 ${r.status === "Submitted" ? "border-accent" : "border-border"}`}
            >
              <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Review cycle</p>
                  <p className="text-headline-md text-ink">{r.period}</p>
                  <p className="mt-1 flex items-center gap-2 text-body-sm text-ink-muted">
                    <Avatar name={r.reviewerName} department={null} size={22} />
                    Reviewed by {r.reviewerName}
                  </p>
                </div>
                {r.status === "Acknowledged" ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-good/15 px-2.5 py-0.5 text-label-sm font-semibold text-good">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Acknowledged
                  </span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-label-sm font-semibold text-accent-ink">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent ring-1 ring-ink/30" />
                    Shared with you
                  </span>
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
                  <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Strengths</p>
                  <p className="mt-1 text-body-md italic text-ink">&ldquo;{r.strengths}&rdquo;</p>
                </div>
              )}
              {r.goals && (
                <div className="mt-3">
                  <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Goals</p>
                  <p className="mt-1 text-body-md text-ink-muted">{r.goals}</p>
                </div>
              )}

              {r.status === "Submitted" && (
                <div className="mt-5 border-t border-border pt-4">
                  <button
                    onClick={() => handleAcknowledge(r)}
                    disabled={isPending}
                    className="flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-label-md font-semibold text-on-accent transition-colors hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" />
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
