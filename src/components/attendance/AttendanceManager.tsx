"use client";

import { useMemo, useState, useTransition } from "react";
import { Trash2, Clock } from "lucide-react";
import { initialsOf } from "@/lib/sample-data";
import {
  formatTime,
  formatDuration,
  formatDay,
  minutesWorked,
  type AttendanceRow,
} from "@/lib/attendance";
import { deleteAttendance } from "@/lib/attendance-actions";
import AttendanceStatusBadge from "./AttendanceStatusBadge";

export default function AttendanceManager({
  initialRecords,
  today,
}: {
  initialRecords: AttendanceRow[];
  today: string;
}) {
  const [list, setList] = useState<AttendanceRow[]>(initialRecords);
  const [dateFilter, setDateFilter] = useState(today);
  const [isPending, startTransition] = useTransition();

  const visible = useMemo(
    () => list.filter((r) => r.date === dateFilter),
    [list, dateFilter],
  );

  // Stat counts for the selected day.
  const counts = useMemo(() => {
    const c = { Present: 0, Late: 0, Absent: 0, Remote: 0 };
    for (const r of visible) if (r.status in c) c[r.status as keyof typeof c]++;
    return c;
  }, [visible]);

  function handleDelete(row: AttendanceRow) {
    if (!window.confirm(`Delete ${row.employeeName}'s attendance for ${formatDay(row.date)}?`)) return;
    startTransition(async () => {
      try {
        await deleteAttendance(row.id);
        setList((prev) => prev.filter((r) => r.id !== row.id));
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Could not delete the record.");
      }
    });
  }

  const selectClass =
    "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/40";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Attendance</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {isPending ? "Working…" : `${visible.length} record${visible.length === 1 ? "" : "s"} on ${formatDay(dateFilter)}`}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          Date
          <input
            type="date"
            className={selectClass}
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </label>
      </div>

      {/* Stat cards for the selected day */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Present" value={counts.Present} tone="good" />
        <StatCard label="Late" value={counts.Late} tone="warning" />
        <StatCard label="Remote" value={counts.Remote} tone="accent" />
        <StatCard label="Absent" value={counts.Absent} tone="critical" />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-ink-faint">
                <th className="px-4 py-3 font-medium sm:px-5">Employee</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell sm:px-5">Clock in</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell sm:px-5">Clock out</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell sm:px-5">Hours</th>
                <th className="px-4 py-3 font-medium sm:px-5">Status</th>
                <th className="px-4 py-3 font-medium text-right sm:px-5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-surface-2"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-chart-2 text-[11px] font-semibold text-white">
                        {initialsOf(r.employeeName)}
                      </div>
                      <span className="font-medium text-ink">{r.employeeName}</span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-ink-muted sm:table-cell sm:px-5">{formatTime(r.clockIn)}</td>
                  <td className="hidden px-4 py-3 text-ink-muted md:table-cell sm:px-5">{formatTime(r.clockOut)}</td>
                  <td className="hidden px-4 py-3 text-ink-muted lg:table-cell sm:px-5">
                    {formatDuration(minutesWorked(r.clockIn, r.clockOut))}
                  </td>
                  <td className="px-4 py-3 sm:px-5"><AttendanceStatusBadge status={r.status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => handleDelete(r)}
                        aria-label={`Delete ${r.employeeName}'s record`}
                        className="grid h-8 w-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface hover:text-critical"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {visible.length === 0 && (
          <div className="grid place-items-center py-16 text-center">
            <div>
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-surface-2">
                <Clock className="h-5 w-5 text-ink-faint" />
              </div>
              <p className="mt-3 text-sm font-medium text-ink">No attendance recorded</p>
              <p className="mt-1 text-sm text-ink-muted">Nothing logged for {formatDay(dateFilter)}.</p>
            </div>
          </div>
        )}
      </div>
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
  tone: "good" | "warning" | "critical" | "accent";
}) {
  const dot = {
    good: "bg-good",
    warning: "bg-warning",
    critical: "bg-critical",
    accent: "bg-accent",
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
