"use client";

import { CalendarDays, AlertTriangle, CheckCircle2, MessageSquareText, Check, X, Trash2 } from "lucide-react";
import { ALLOWANCE_TYPES, formatLeaveRange, leaveStyle, type LeaveRow } from "@/lib/leave";
import Avatar from "./Avatar";

/*
  Other people in the same department whose (non-declined) leave overlaps
  this request — the "coverage check". Shared by the desktop approvals rail
  (LeaveQueue) and the phone request cards below.
*/
export function overlapsFor(r: LeaveRow, allRequests: LeaveRow[]): string[] {
  if (!r.department) return [];
  return [
    ...new Set(
      allRequests
        .filter(
          (o) =>
            o.employeeId !== r.employeeId &&
            o.department === r.department &&
            o.status !== "Rejected" &&
            o.startDate <= r.endDate &&
            o.endDate >= r.startDate,
        )
        .map((o) => o.employeeName),
    ),
  ];
}

/*
  One leave request as a phone/tablet card (the mobile mockup's design):
    who + leave type → a sunken "dates" well (with the allowance left)
    → the coverage check (managers, pending only) → the note
    → full-width Decline / Approve (managers, pending only).
  Delete / cancel stays available as a small 48px icon button.
*/
export default function LeaveRequestCard({
  r,
  allRequests,
  today,
  weekAhead,
  balance,
  canManage,
  isSelf,
  busy,
  onStatus,
  onDelete,
}: {
  r: LeaveRow;
  allRequests: LeaveRow[];
  today: string;
  weekAhead: string;
  balance: { remaining: number; allowance: number } | null;
  canManage: boolean;
  isSelf: boolean;
  busy: boolean;
  onStatus: (row: LeaveRow, status: "Approved" | "Rejected") => void;
  onDelete: (row: LeaveRow) => void;
}) {
  const pending = r.status === "Pending";
  const canDecide = canManage && pending;
  // Only Vacation/Personal use up the allowance, so only they show "days left".
  const bal = ALLOWANCE_TYPES.includes(r.type) ? balance : null;
  const overlaps = canDecide ? overlapsFor(r, allRequests) : [];
  const timing = !pending ? "" : r.startDate < today ? " · retrospective" : r.startDate <= weekAhead ? " · starts within a week" : "";
  const submitted = formatLeaveRange(r.createdAt.slice(0, 10), r.createdAt.slice(0, 10));

  const deleteButton = (
    <button
      type="button"
      disabled={busy}
      onClick={() => onDelete(r)}
      aria-label={`${isSelf ? "Cancel" : "Delete"} ${r.employeeName}'s ${r.type.toLowerCase()} request`}
      title={isSelf ? "Cancel request" : "Delete request"}
      className="grid size-tap shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-critical/10 hover:text-critical disabled:opacity-50"
    >
      <Trash2 className="h-4 w-4" aria-hidden />
    </button>
  );

  return (
    <article className="rounded-xl border border-border bg-surface p-4">
      {/* Who + leave type */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={r.employeeName} department={r.department} size={44} />
          <div className="min-w-0">
            <h3 className="truncate font-display text-headline-sm text-ink">{r.employeeName}</h3>
            <p className="truncate text-body-sm text-ink-muted">
              {r.department ?? "No department"} · Submitted {submitted}
            </p>
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-label-sm font-semibold ${leaveStyle(r.type).chip}`}>{r.type}</span>
      </div>

      {/* Dates well */}
      <div className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-sunken p-3">
        <div className="flex min-w-0 items-start gap-3">
          <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" aria-hidden />
          <div className="min-w-0">
            <p className="font-display text-label-md font-semibold text-ink">{formatLeaveRange(r.startDate, r.endDate)}</p>
            <p className="tnum text-body-sm text-ink-muted">
              {r.days} {r.days === 1 ? "day" : "days"} requested{timing}
            </p>
          </div>
        </div>
        {bal && (
          <span className="tnum shrink-0 rounded-md border border-border bg-surface px-2 py-1 text-label-sm font-semibold text-ink">
            {bal.remaining} {bal.remaining === 1 ? "day" : "days"} left
          </span>
        )}
      </div>

      {/* Coverage check (managers deciding a pending request) */}
      {canDecide &&
        (overlaps.length > 0 ? (
          <div className="mt-3 flex gap-3 rounded-lg border border-accent/40 bg-accent-soft p-3 text-body-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-ink" aria-hidden />
            <p className="min-w-0">
              <span className="block font-semibold text-accent-ink">
                {overlaps.length} {overlaps.length === 1 ? "other" : "others"} in {r.department} {overlaps.length === 1 ? "is" : "are"} off then
              </span>
              <span className="text-ink [overflow-wrap:anywhere]">{overlaps.join(", ")} will be unavailable.</span>
            </p>
          </div>
        ) : r.department ? (
          <div className="mt-3 flex gap-3 rounded-lg bg-sunken p-3 text-body-sm text-ink-muted">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" aria-hidden />
            <p>No one else in {r.department} is off on these dates.</p>
          </div>
        ) : null)}

      {/* The note that came with the request */}
      {r.reason && (
        <div className="mt-3 flex gap-3 rounded-lg bg-sunken p-3 text-body-sm text-ink">
          <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
          <p className="min-w-0 [overflow-wrap:anywhere]">{r.reason}</p>
        </div>
      )}

      {/* Actions: big side-by-side pills for a decision, otherwise just delete/cancel */}
      {canDecide ? (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatus(r, "Rejected")}
            className="inline-flex min-h-tap flex-1 items-center justify-center gap-2 rounded-full bg-sunken text-label-md font-semibold text-ink transition-colors hover:bg-surface-2 disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden /> Decline
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onStatus(r, "Approved")}
            className="inline-flex min-h-tap flex-1 items-center justify-center gap-2 rounded-full bg-navy text-label-md font-semibold text-on-navy transition-colors hover:bg-navy-2 disabled:opacity-50"
          >
            <Check className="h-4 w-4" aria-hidden /> Approve
          </button>
          {deleteButton}
        </div>
      ) : (
        <div className="-mb-2 -mr-2 mt-1 flex justify-end">{deleteButton}</div>
      )}
    </article>
  );
}
