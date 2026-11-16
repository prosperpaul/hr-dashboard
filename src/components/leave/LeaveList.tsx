"use client";

import { Check, X, Trash2 } from "lucide-react";
import { formatLeaveRange, leaveStyle, type LeaveRow } from "@/lib/leave";
import Avatar from "./Avatar";

/*
  A plain table of requests in ONE status (Pending / Approved / Declined),
  shown when you pick that tab above the timeline.
  Pending rows get Approve/Decline for managers; every row can be deleted
  (managers) or cancelled (your own request).
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

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-body-md">
          <thead>
            <tr className="border-b border-border bg-bg text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
              <th className="px-4 py-3">{isSelf ? "Request" : "Team member"}</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Dates</th>
              <th className="px-4 py-3">Days</th>
              <th className="hidden px-4 py-3 md:table-cell">Reason</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="h-12 border-b border-border last:border-0 hover:bg-bg">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={r.employeeName} department={r.department} size={28} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{r.employeeName}</p>
                      <p className="truncate text-body-sm text-ink-muted">
                        Submitted {formatLeaveRange(r.createdAt.slice(0, 10), r.createdAt.slice(0, 10))}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-full border px-2.5 py-0.5 text-label-sm font-semibold ${leaveStyle(r.type).chip}`}>{r.type}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-ink">{formatLeaveRange(r.startDate, r.endDate)}</td>
                <td className="tnum px-4 py-2.5 text-ink">{r.days}</td>
                <td className="hidden max-w-[220px] truncate px-4 py-2.5 text-ink-muted md:table-cell" title={r.reason ?? ""}>
                  {r.reason ?? "—"}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-end gap-1">
                    {canManage && r.status === "Pending" && (
                      <>
                        <button
                          disabled={busy}
                          onClick={() => onStatus(r, "Rejected")}
                          className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-surface px-3 text-label-sm text-ink hover:bg-bg disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" /> Decline
                        </button>
                        <button
                          disabled={busy}
                          onClick={() => onStatus(r, "Approved")}
                          className="inline-flex h-8 items-center gap-1 rounded-full bg-navy px-3 text-label-sm font-semibold text-on-navy hover:bg-navy-2 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" /> Approve
                        </button>
                      </>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => onDelete(r)}
                      aria-label={`${isSelf ? "Cancel" : "Delete"} request`}
                      title={isSelf ? "Cancel request" : "Delete request"}
                      className="grid h-8 w-8 place-items-center rounded-full text-ink-muted transition-colors hover:bg-critical/10 hover:text-critical disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <p className="py-14 text-center text-body-md text-ink-muted">No {label} requests.</p>}
      </div>
    </section>
  );
}
