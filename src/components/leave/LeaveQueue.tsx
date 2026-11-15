"use client";

import { useState } from "react";
import { CalendarDays, Trash2 } from "lucide-react";
import { initialsOf } from "@/lib/sample-data";
import { ALLOWANCE_TYPES, LEAVE_STATUSES, formatLeaveRange, leaveStyle, type LeaveRow } from "@/lib/leave";

/*
  "Queue & Triage": requests grouped into Pending / Approved / Rejected tabs.
  Pending cards get Approve/Reject (managers only); every card can be
  deleted (managers) or cancelled (the employee's own request).
*/
export default function LeaveQueue({
  requests,
  remainingFor,
  canManage,
  isSelf,
  busy,
  onStatus,
  onDelete,
}: {
  requests: LeaveRow[];
  remainingFor: (employeeId: string) => { remaining: number; allowance: number } | null;
  canManage: boolean;
  isSelf: boolean;
  busy: boolean;
  onStatus: (row: LeaveRow, status: "Approved" | "Rejected") => void;
  onDelete: (row: LeaveRow) => void;
}) {
  const [tab, setTab] = useState<string>("Pending");

  const counts = Object.fromEntries(LEAVE_STATUSES.map((s) => [s, requests.filter((r) => r.status === s).length]));
  // Pending: soonest first. Others: most recent first.
  const list = requests
    .filter((r) => r.status === tab)
    .sort((a, b) => (tab === "Pending" ? a.startDate.localeCompare(b.startDate) : b.startDate.localeCompare(a.startDate)));

  const accentBar: Record<string, string> = {
    Pending: "border-l-accent",
    Approved: "border-l-border-strong",
    Rejected: "border-l-critical/50",
  };

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-headline-md text-ink">{isSelf ? "My Requests" : "Queue & Triage"}</h2>
        {counts.Pending > 0 && <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />}
      </div>

      {/* Tabs */}
      <div className="mt-4 flex rounded-lg border border-border bg-bg p-0.5" role="tablist">
        {LEAVE_STATUSES.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={tab === s}
            onClick={() => setTab(s)}
            className={[
              "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-label-sm transition-colors",
              tab === s ? "bg-surface-2 text-accent-hover" : "text-ink-faint hover:text-ink",
            ].join(" ")}
          >
            {s}
            <span className="tnum rounded-full bg-bg px-1.5 text-[10px] text-ink-muted">{counts[s]}</span>
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="mt-4 max-h-[720px] space-y-3 overflow-y-auto pr-1">
        {list.map((r) => {
          const bal = ALLOWANCE_TYPES.includes(r.type) ? remainingFor(r.employeeId) : null;
          return (
            <article key={r.id} className={`rounded-lg border border-border border-l-2 ${accentBar[r.status] ?? ""} bg-surface-2 p-3.5`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-bg text-label-sm font-semibold text-accent-hover">
                    {initialsOf(r.employeeName)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-label-md text-ink">{r.employeeName}</p>
                    <p className="truncate text-body-sm text-ink-faint">{r.department ?? "No department"}</p>
                  </div>
                </div>
                <span className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-label-sm ${leaveStyle(r.type).chip}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${leaveStyle(r.type).dot}`} />
                  {r.type}
                </span>
              </div>

              <div className="mt-3 rounded-md border border-border bg-bg/60 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-label-md text-ink">
                    <CalendarDays className="h-3.5 w-3.5 text-ink-faint" />
                    {formatLeaveRange(r.startDate, r.endDate)}
                  </span>
                  <span className="tnum text-label-md text-accent-hover">
                    {r.days} {r.days === 1 ? "day" : "days"}
                  </span>
                </div>
                {bal && (
                  <div className="mt-1.5 flex items-center justify-between text-body-sm">
                    <span className="text-ink-faint">Remaining allowance</span>
                    <span className="tnum text-ink-muted">
                      {bal.remaining} of {bal.allowance} days
                    </span>
                  </div>
                )}
              </div>

              {r.reason && <p className="mt-2.5 text-body-sm italic text-ink-muted">&ldquo;{r.reason}&rdquo;</p>}

              <div className="mt-3 flex items-center gap-2">
                {canManage && r.status === "Pending" ? (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => onStatus(r, "Rejected")}
                      className="h-8 flex-1 rounded-md border border-border bg-surface text-label-sm text-ink-muted transition-colors hover:border-border-strong hover:text-ink disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => onStatus(r, "Approved")}
                      className="h-8 flex-1 rounded-md bg-accent text-label-sm font-semibold text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] transition-colors hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-50"
                    >
                      Approve
                    </button>
                  </>
                ) : (
                  <span className="flex-1 text-body-sm text-ink-faint">
                    Submitted {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
                <button
                  disabled={busy}
                  onClick={() => onDelete(r)}
                  aria-label={`${isSelf ? "Cancel" : "Delete"} request`}
                  title={isSelf ? "Cancel request" : "Delete request"}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-faint transition-colors hover:bg-critical/10 hover:text-critical disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </article>
          );
        })}

        {list.length === 0 && (
          <p className="py-10 text-center text-body-md text-ink-muted">
            {tab === "Pending" ? "Nothing waiting — all caught up 🎉" : `No ${tab.toLowerCase()} requests.`}
          </p>
        )}
      </div>
    </section>
  );
}
