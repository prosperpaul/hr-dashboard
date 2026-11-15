"use client";

import { useState, useTransition } from "react";
import { setLeaveStatus } from "@/lib/leave-actions";

export type PendingLeave = {
  id: string;
  name: string;
  initials: string;
  detail: string; // e.g. "Vacation · 5 days"
  range: string; // e.g. "Nov 18–22"
};

/*
  The "Needs Attention" list: pending leave requests with Approve / Decline.

  The buttons call the SAME server action the Leave page uses
  (setLeaveStatus), which re-checks on the server that you're allowed to
  approve leave. While it runs we dim the row; when it finishes, the server
  refreshes the page and the row disappears from the pending list.
*/
export default function ApprovalQueue({ requests }: { requests: PendingLeave[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function decide(id: string, status: "Approved" | "Rejected") {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        await setLeaveStatus(id, status);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setBusyId(null);
      }
    });
  }

  if (requests.length === 0) {
    return <p className="py-6 text-center text-body-md text-ink-muted">You&apos;re all caught up 🎉</p>;
  }

  return (
    <div className="space-y-2">
      {error && <p className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2 text-body-sm text-critical">{error}</p>}

      {requests.map((r) => (
        <div
          key={r.id}
          className={`rounded-lg border border-border bg-surface-2 p-2.5 transition-opacity ${busyId === r.id ? "opacity-50" : ""}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-bg text-label-md font-semibold text-accent-hover">
                {r.initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-label-md text-ink">{r.name}</p>
                <p className="truncate text-body-sm text-ink-faint">{r.detail}</p>
              </div>
            </div>
            <span className="tnum shrink-0 rounded-md bg-bg px-2 py-0.5 text-label-sm text-ink-muted">{r.range}</span>
          </div>

          <div className="mt-2 flex items-center justify-end gap-2 border-t border-border pt-2">
            <button
              type="button"
              disabled={busyId !== null}
              onClick={() => decide(r.id, "Rejected")}
              className="rounded-md border border-border bg-surface px-2.5 py-1 text-label-sm text-ink-muted transition-colors hover:border-border-strong hover:text-ink disabled:cursor-not-allowed"
            >
              Decline
            </button>
            <button
              type="button"
              disabled={busyId !== null}
              onClick={() => decide(r.id, "Approved")}
              className="rounded-md bg-accent px-3 py-1 text-label-sm font-semibold text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] transition-colors hover:bg-accent-hover active:bg-accent-pressed disabled:cursor-not-allowed"
            >
              Approve
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
