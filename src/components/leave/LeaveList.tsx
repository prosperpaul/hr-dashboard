"use client";

import { Check, X, Trash2 } from "lucide-react";
import { formatLeaveRange, leaveStyle, type LeaveRow } from "@/lib/leave";
import ResponsiveList from "@/components/ui/ResponsiveList";
import Avatar from "./Avatar";

/*
  A list of requests in ONE status (Pending / Approved / Declined),
  shown when you pick that tab above the timeline.
  Pending rows get Approve/Decline for managers; every row can be deleted
  (managers) or cancelled (your own request).

  ResponsiveList draws a table from md up, and a stacked card per request
  on phones (with full-size 48px buttons underneath).
*/
export default function LeaveList({
  rows,
  status,
  canManage,
  isSelf,
  busy,
  onStatus,
  onDelete,
}: {
  rows: LeaveRow[];
  status: string; // "Pending" | "Approved" | "Rejected"
  canManage: boolean;
  isSelf: boolean;
  busy: boolean;
  onStatus: (row: LeaveRow, status: "Approved" | "Rejected") => void;
  onDelete: (row: LeaveRow) => void;
}) {
  // Pending: soonest first. Others: most recent first.
  const list = [...rows].sort((a, b) => (status === "Pending" ? a.startDate.localeCompare(b.startDate) : b.startDate.localeCompare(a.startDate)));
  const label = status === "Rejected" ? "declined" : status.toLowerCase();
  const submitted = (r: LeaveRow) => `Submitted ${formatLeaveRange(r.createdAt.slice(0, 10), r.createdAt.slice(0, 10))}`;
  const typeChip = (r: LeaveRow) => (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-label-sm font-semibold ${leaveStyle(r.type).chip}`}>{r.type}</span>
  );

  // The delete / cancel button. `compact` is the small 32px desktop version.
  const deleteButton = (r: LeaveRow, compact: boolean) => (
    <button
      disabled={busy}
      onClick={() => onDelete(r)}
      aria-label={`${isSelf ? "Cancel" : "Delete"} ${r.employeeName}'s ${r.type.toLowerCase()} request`}
      title={isSelf ? "Cancel request" : "Delete request"}
      className={`grid shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-critical/10 hover:text-critical disabled:opacity-50 ${
        compact ? "h-8 w-8" : "size-tap"
      }`}
    >
      <Trash2 className="h-4 w-4" aria-hidden />
    </button>
  );

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <ResponsiveList
        caption={`${status === "Rejected" ? "Declined" : status} leave requests`}
        rows={list}
        getKey={(r) => r.id}
        // Pad the table inside the card (its first/last cells have no side padding).
        tableClassName="md:px-4"
        listClassName="px-4"
        empty={<p className="py-14 text-center text-body-md text-ink-muted">No {label} requests.</p>}
        columns={[
          {
            key: "who",
            header: isSelf ? "Request" : "Team member",
            cell: (r) => (
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar name={r.employeeName} department={r.department} size={28} />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{r.employeeName}</p>
                  <p className="truncate text-body-sm text-ink-muted">{submitted(r)}</p>
                </div>
              </div>
            ),
          },
          { key: "type", header: "Type", cell: typeChip },
          { key: "dates", header: "Dates", className: "whitespace-nowrap text-ink", cell: (r) => formatLeaveRange(r.startDate, r.endDate) },
          { key: "days", header: "Days", className: "tnum text-ink", cell: (r) => r.days },
          {
            key: "reason",
            header: "Reason",
            className: "max-w-55 truncate text-ink-muted",
            cell: (r) => <span title={r.reason ?? ""}>{r.reason ?? "—"}</span>,
          },
          {
            key: "actions",
            header: "Actions",
            align: "right",
            cell: (r) => (
              <div className="flex items-center justify-end gap-1">
                {canManage && r.status === "Pending" && (
                  <>
                    <button
                      disabled={busy}
                      onClick={() => onStatus(r, "Rejected")}
                      className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-surface px-3 text-label-sm text-ink hover:bg-bg disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden /> Decline
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => onStatus(r, "Approved")}
                      className="inline-flex h-8 items-center gap-1 rounded-full bg-navy px-3 text-label-sm font-semibold text-on-navy hover:bg-navy-2 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden /> Approve
                    </button>
                  </>
                )}
                {deleteButton(r, true)}
              </div>
            ),
          },
        ]}
        // Phone card: who + type, dates & days, the note, then the actions.
        renderRow={(r) => {
          const canDecide = canManage && r.status === "Pending";
          return (
            <div className="min-w-0 py-3">
              <div className="flex min-w-0 items-start gap-3">
                <Avatar name={r.employeeName} department={r.department} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-label-md font-semibold text-ink">{r.employeeName}</p>
                  <p className="text-body-md text-ink">{formatLeaveRange(r.startDate, r.endDate)}</p>
                  <p className="tnum text-body-sm text-ink-muted">
                    {r.days} {r.days === 1 ? "day" : "days"} · {submitted(r)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {typeChip(r)}
                  {!canDecide && deleteButton(r, false)}
                </div>
              </div>
              {r.reason && <p className="mt-2 text-body-sm text-ink-muted [overflow-wrap:anywhere]">{r.reason}</p>}
              {canDecide && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    disabled={busy}
                    onClick={() => onStatus(r, "Rejected")}
                    className="inline-flex min-h-tap flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-surface text-label-md text-ink hover:bg-bg disabled:opacity-50"
                  >
                    <X className="h-4 w-4" aria-hidden /> Decline
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => onStatus(r, "Approved")}
                    className="inline-flex min-h-tap flex-1 items-center justify-center gap-1.5 rounded-full bg-navy text-label-md font-semibold text-on-navy hover:bg-navy-2 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" aria-hidden /> Approve
                  </button>
                  {deleteButton(r, false)}
                </div>
              )}
            </div>
          );
        }}
      />
    </section>
  );
}
