"use client";

import { CalendarDays, AlertTriangle, CheckCircle2, Trash2, Info } from "lucide-react";
import { ALLOWANCE_TYPES, formatLeaveRange, leaveStyle, type LeaveRow } from "@/lib/leave";
import Avatar from "./Avatar";
import { overlapsFor } from "./LeaveRequestCard";

/*
  "Waiting for approval" — the right-hand rail of PENDING requests.
  Managers get Decline / Approve on each card; everyone can delete
  (managers) or cancel (their own request).

  For managers each card also runs a real COVERAGE CHECK: who else in the
  same department has approved or pending leave overlapping these dates.
*/
export default function LeaveQueue({
  pending,
  allRequests,
  today,
  weekAhead,
  remainingFor,
  canManage,
  isSelf,
  busy,
  onStatus,
  onDelete,
}: {
  pending: LeaveRow[]; // the pending requests to show (already filtered)
  allRequests: LeaveRow[]; // everything, for the coverage check
  today: string;
  weekAhead: string; // today + 6 days — a request starting by then is "urgent"
  remainingFor: (employeeId: string) => { remaining: number; allowance: number } | null;
  canManage: boolean;
  isSelf: boolean;
  busy: boolean;
  onStatus: (row: LeaveRow, status: "Approved" | "Rejected") => void;
  onDelete: (row: LeaveRow) => void;
}) {
  // Soonest first, so the most time-sensitive request is on top.
  const list = [...pending].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const urgent = list.filter((r) => r.startDate <= weekAhead).length;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-bg px-4 py-4 md:px-5">
        <h2 className="flex items-center gap-2 text-headline-sm text-ink">
          <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${list.length ? "bg-critical" : "bg-good"}`} />
          {isSelf ? "Your pending requests" : "Waiting for approval"}
        </h2>
        {urgent > 0 ? (
          <span className="tnum rounded-full bg-critical/10 px-2.5 py-0.5 text-label-sm font-bold text-critical">{urgent} urgent</span>
        ) : (
          <span className="tnum rounded-full bg-surface-2 px-2.5 py-0.5 text-label-sm text-ink-muted">{list.length}</span>
        )}
      </div>

      {/* The list only scrolls inside its own box from lg up (where it's a side
          rail). On phones the page scrolls instead: no scroll-inside-scroll. */}
      <div className="divide-y divide-border lg:max-h-[760px] lg:overflow-y-auto">
        {list.map((r) => {
          const bal = ALLOWANCE_TYPES.includes(r.type) ? remainingFor(r.employeeId) : null;
          const overlaps = canManage ? overlapsFor(r, allRequests) : [];
          const startsSoon = r.startDate <= weekAhead;
          const late = r.startDate < today; // asked for after the leave already started
          return (
            <article key={r.id} className="p-4 md:p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={r.employeeName} department={r.department} size={36} />
                  <div className="min-w-0">
                    <p className="truncate font-display text-label-md font-semibold text-ink">{r.employeeName}</p>
                    <p className="truncate text-body-sm text-ink-muted">{r.department ?? "No department"}</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-label-sm font-semibold ${leaveStyle(r.type).chip}`}>{r.type}</span>
              </div>

              <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-body-md text-ink">
                <CalendarDays className="h-4 w-4 text-ink-muted" aria-hidden />
                <span className="font-semibold">{formatLeaveRange(r.startDate, r.endDate)}</span>
                <span className="tnum text-ink-muted">
                  · {r.days} {r.days === 1 ? "day" : "days"}
                  {late ? " (retrospective)" : startsSoon ? " · starts within a week" : ""}
                </span>
              </p>

              {bal && (
                <p className="tnum mt-1 text-body-sm text-ink-muted">
                  {bal.remaining} of {bal.allowance} allowance days left
                </p>
              )}

              {/* Coverage check (managers only) */}
              {canManage &&
                (overlaps.length > 0 ? (
                  <div className="mt-3 flex gap-2 rounded-md border border-critical/30 bg-critical/10 p-3 text-body-sm text-critical">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <p>
                      <span className="font-bold">Coverage warning:</span> {overlaps.length} {overlaps.length === 1 ? "other" : "others"} in{" "}
                      {r.department} {overlaps.length === 1 ? "is" : "are"} off at the same time ({overlaps.join(", ")}).
                    </p>
                  </div>
                ) : r.department ? (
                  <div className="mt-3 flex gap-2 rounded-md bg-surface-2 p-3 text-body-sm text-ink-muted">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <p>No one else in {r.department} is off on these dates.</p>
                  </div>
                ) : null)}

              {r.reason && (
                <div className="mt-3 flex gap-2 rounded-md border border-accent/40 bg-accent-soft p-3 text-body-sm text-ink">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden />
                  <p className="min-w-0 [overflow-wrap:anywhere]">Note: {r.reason}</p>
                </div>
              )}

              <div className="mt-4 flex items-center gap-2">
                {canManage ? (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => onStatus(r, "Rejected")}
                      className="min-h-tap flex-1 rounded-full border border-border bg-surface text-label-md text-ink transition-colors hover:bg-bg disabled:opacity-50 lg:min-h-9"
                    >
                      Decline
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => onStatus(r, "Approved")}
                      className="min-h-tap flex-1 rounded-full bg-navy text-label-md font-semibold text-on-navy transition-colors hover:bg-navy-2 disabled:opacity-50 lg:min-h-9"
                    >
                      Approve leave
                    </button>
                  </>
                ) : (
                  <span className="min-w-0 flex-1 text-body-sm text-ink-muted">Submitted {formatLeaveRange(r.createdAt.slice(0, 10), r.createdAt.slice(0, 10))}</span>
                )}
                <button
                  disabled={busy}
                  onClick={() => onDelete(r)}
                  aria-label={`${isSelf ? "Cancel" : "Delete"} request`}
                  title={isSelf ? "Cancel request" : "Delete request"}
                  className="grid size-tap shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-critical/10 hover:text-critical disabled:opacity-50 lg:size-9"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </article>
          );
        })}

        {list.length === 0 && <p className="px-5 py-10 text-center text-body-md text-ink-muted">Nothing waiting. All caught up.</p>}
      </div>
    </section>
  );
}
