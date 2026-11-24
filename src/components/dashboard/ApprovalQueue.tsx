"use client";

import { useState, useTransition } from "react";
import { setLeaveStatus } from "@/lib/leave-actions";
import { deptTint } from "@/lib/dept-tint";

export type PendingLeave = {
  id: string;
  name: string;
  initials: string;
  detail: string; // e.g. "5 days Vacation leave"
  department: string | null;
  range: string; // e.g. "Nov 18–22"
};

/*
  The "Needs your attention" list: pending leave requests with Approve / Decline.

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
    return (
      <p className="rounded-xl border border-border bg-surface px-6 py-10 text-center text-body-md text-ink-muted">
        You&apos;re all caught up — no requests waiting.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {error && <p role="alert" className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2 text-body-sm text-critical">{error}</p>}

      {requests.map((r) => (
        <div
          key={r.id}
          className={`flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 transition-opacity md:p-5 sm:flex-row sm:items-center sm:justify-between ${
            busyId === r.id ? "opacity-50" : ""
          }`}
        >
          <div className="flex min-w-0 items-center gap-4">
            <div className={`font-display grid h-11 w-11 shrink-0 place-items-center rounded-full text-[15px] font-bold text-ink ${deptTint(r.department)}`}>
              {r.initials}
            </div>
            <div className="min-w-0">
              <p className="font-display truncate text-[17px] font-semibold text-ink">{r.name}</p>
              <p className="truncate text-body-md text-ink-muted">
                {r.detail} · <span className="tnum">{r.range}</span>
              </p>
              {r.department && (
                <p className="mt-0.5 truncate text-eyebrow uppercase text-ink-faint">{r.department}</p>
              )}
            </div>
          </div>

          {/* Phones: two full-width halves (easy thumb targets, 48px tall).
              sm+: the usual pair of pills on the right; compact from lg. */}
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:items-center">
            <button
              type="button"
              disabled={busyId !== null}
              onClick={() => decide(r.id, "Rejected")}
              className="min-h-tap rounded-full border border-border bg-surface px-4 lg:min-h-0 lg:h-9 text-label-md text-ink transition-colors hover:bg-bg disabled:cursor-not-allowed"
            >
              Decline
            </button>
            <button
              type="button"
              disabled={busyId !== null}
              onClick={() => decide(r.id, "Approved")}
              className="min-h-tap rounded-full bg-navy px-4 lg:min-h-0 lg:h-9 text-label-md text-on-navy transition-opacity hover:opacity-90 disabled:cursor-not-allowed"
            >
              Approve
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
