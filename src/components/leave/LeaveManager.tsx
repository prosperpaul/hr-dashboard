"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Check, X, Trash2, CalendarDays } from "lucide-react";
import { initialsOf } from "@/lib/sample-data";
import { LEAVE_STATUSES, usedAllowanceDays, type LeaveRow, type LeaveInput } from "@/lib/leave";
import {
  createLeaveRequest,
  setLeaveStatus,
  deleteLeaveRequest,
} from "@/lib/leave-actions";
import LeaveRequestModal from "./LeaveRequestModal";

type EmployeeOption = { id: string; name: string };

function formatRange(start: string, end: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return `${start} – ${end}`;
  const sStr = s.toLocaleDateString("en-US", opts);
  if (start === end) return sStr;
  return `${sStr} – ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Pending: "bg-warning/15 text-warning ring-warning/40",
    Approved: "bg-good/15 text-good ring-good/40",
    Rejected: "bg-critical/15 text-critical ring-critical/40",
  };
  const cls = styles[status] ?? "bg-surface-2 text-ink-muted ring-border";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cls}`}>
      {status}
    </span>
  );
}

export default function LeaveManager({
  initialRequests,
  employees,
  canManage,
  selfEmployeeId = null,
  allowance = null,
}: {
  initialRequests: LeaveRow[];
  employees: EmployeeOption[];
  canManage: boolean;
  // The linked employee id of the current user (self-service). Null if none.
  selfEmployeeId?: string | null;
  // The self-service user's annual leave allowance (days). Null in manage mode.
  allowance?: number | null;
}) {
  // Self-service mode: not a manager, but linked to an employee record.
  const isSelf = !canManage && !!selfEmployeeId;
  const canRequest = canManage || isSelf; // who may open the "new request" form

  const [list, setList] = useState<LeaveRow[]>(initialRequests);
  const [statusFilter, setStatusFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Summary counts for the stat cards.
  const counts = useMemo(() => {
    const c = { Pending: 0, Approved: 0, Rejected: 0 };
    for (const r of list) if (r.status in c) c[r.status as keyof typeof c]++;
    return c;
  }, [list]);

  // Self-service leave balance (only meaningful when we know the allowance).
  const used = useMemo(() => usedAllowanceDays(list), [list]);
  const remaining = allowance !== null ? Math.max(0, allowance - used) : null;

  const filtered = useMemo(
    () => (statusFilter === "All" ? list : list.filter((r) => r.status === statusFilter)),
    [list, statusFilter],
  );

  function handleSave(data: LeaveInput) {
    startTransition(async () => {
      try {
        await createLeaveRequest(data);
        // Server data is revalidated; reflect it locally by re-reading via a
        // soft refresh. Simplest: add an optimistic row using the employee name.
        const empName = employees.find((e) => e.id === data.employeeId)?.name ?? "—";
        const ms = new Date(data.endDate).getTime() - new Date(data.startDate).getTime();
        const days = Math.max(1, Math.round(ms / 86_400_000) + 1);
        setList((prev) => [
          {
            id: `temp-${Date.now()}`,
            employeeId: data.employeeId,
            employeeName: empName,
            type: data.type,
            startDate: data.startDate,
            endDate: data.endDate,
            days,
            reason: data.reason.trim() || null,
            status: "Pending",
          },
          ...prev,
        ]);
        setModalOpen(false);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Could not create the request.");
      }
    });
  }

  function handleStatus(row: LeaveRow, status: string) {
    startTransition(async () => {
      try {
        await setLeaveStatus(row.id, status);
        setList((prev) => prev.map((r) => (r.id === row.id ? { ...r, status } : r)));
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Could not update the request.");
      }
    });
  }

  function handleDelete(row: LeaveRow) {
    if (!window.confirm(`Delete ${row.employeeName}'s ${row.type.toLowerCase()} request?`)) return;
    startTransition(async () => {
      try {
        await deleteLeaveRequest(row.id);
        setList((prev) => prev.filter((r) => r.id !== row.id));
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Could not delete the request.");
      }
    });
  }

  const selectClass =
    "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/40";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            {canManage ? "Leave" : "My leave"}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {isPending ? "Working…" : `${list.length} time-off request${list.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {canRequest && (
          <button
            onClick={() => setModalOpen(true)}
            disabled={isPending || employees.length === 0}
            className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            {canManage ? "New request" : "Request leave"}
          </button>
        )}
      </div>

      {/* Stat cards — self-service shows the leave BALANCE; managers see counts */}
      {isSelf && remaining !== null ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Days remaining" value={remaining} tone="good" />
          <StatCard label="Days used" value={used} tone="warning" />
          <StatCard label="Annual allowance" value={allowance ?? 0} tone="neutral" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Pending" value={counts.Pending} tone="warning" />
          <StatCard label="Approved" value={counts.Approved} tone="good" />
          <StatCard label="Rejected" value={counts.Rejected} tone="critical" />
        </div>
      )}
      {isSelf && (
        <p className="-mt-2 text-xs text-ink-faint">
          Based on approved Vacation &amp; Personal leave this year. Sick and Unpaid
          leave don&apos;t count against your allowance.
        </p>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <select
          className={selectClass}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="All">All statuses</option>
          {LEAVE_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-ink-faint">
                <th className="px-5 py-3 font-medium">Employee</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Dates</th>
                <th className="px-5 py-3 font-medium">Days</th>
                <th className="px-5 py-3 font-medium">Status</th>
                {(canManage || isSelf) && (
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-surface-2"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-chart-2 text-[11px] font-semibold text-white">
                        {initialsOf(r.employeeName)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{r.employeeName}</p>
                        {r.reason && (
                          <p className="truncate text-xs text-ink-muted">{r.reason}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-ink-muted">{r.type}</td>
                  <td className="px-5 py-3 text-ink-muted">{formatRange(r.startDate, r.endDate)}</td>
                  <td className="px-5 py-3 text-ink-muted">{r.days}</td>
                  <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                  {(canManage || isSelf) && (
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Approve/reject is managers-only */}
                        {canManage && r.status === "Pending" && (
                          <>
                            <button
                              onClick={() => handleStatus(r, "Approved")}
                              aria-label={`Approve ${r.employeeName}'s request`}
                              className="grid h-8 w-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface hover:text-good"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleStatus(r, "Rejected")}
                              aria-label={`Reject ${r.employeeName}'s request`}
                              className="grid h-8 w-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface hover:text-critical"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        {/* Delete: managers delete any; self-service cancels own */}
                        <button
                          onClick={() => handleDelete(r)}
                          aria-label={`${isSelf ? "Cancel" : "Delete"} ${r.employeeName}'s request`}
                          className="grid h-8 w-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface hover:text-critical"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="grid place-items-center py-16 text-center">
            <div>
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-surface-2">
                <CalendarDays className="h-5 w-5 text-ink-faint" />
              </div>
              <p className="mt-3 text-sm font-medium text-ink">No leave requests</p>
              <p className="mt-1 text-sm text-ink-muted">
                {statusFilter === "All" ? "Nothing here yet." : `No ${statusFilter.toLowerCase()} requests.`}
              </p>
            </div>
          </div>
        )}
      </div>

      <LeaveRequestModal
        open={modalOpen}
        employees={employees}
        fixedEmployeeId={isSelf ? selfEmployeeId : undefined}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "warning" | "good" | "critical" | "neutral";
}) {
  const dot = {
    warning: "bg-warning",
    good: "bg-good",
    critical: "bg-critical",
    neutral: "bg-ink-faint",
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        <p className="text-sm text-ink-muted">{label}</p>
      </div>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{value}</p>
    </div>
  );
}
