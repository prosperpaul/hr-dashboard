"use client";

import { useMemo, useState, useTransition } from "react";
import { LogIn, LogOut, Clock, CheckCircle2, Trash2 } from "lucide-react";
import {
  formatTime,
  formatDuration,
  formatDay,
  minutesWorked,
  isLate,
  type AttendanceRow,
} from "@/lib/attendance";
import { clockIn, clockOut, deleteAttendance } from "@/lib/attendance-actions";
import AttendanceStatusBadge from "./AttendanceStatusBadge";

export default function MyAttendance({
  initialRecords,
  today,
  employeeName,
}: {
  initialRecords: AttendanceRow[];
  today: string;
  employeeName: string;
}) {
  const [list, setList] = useState<AttendanceRow[]>(initialRecords);
  const [isPending, startTransition] = useTransition();

  const todayRec = useMemo(() => list.find((r) => r.date === today) ?? null, [list, today]);
  const hasClockIn = !!todayRec?.clockIn;
  const hasClockOut = !!todayRec?.clockOut;
  const currentlyIn = hasClockIn && !hasClockOut;

  function doClockIn() {
    startTransition(async () => {
      try {
        await clockIn();
        const now = new Date().toISOString();
        const status = isLate(now) ? "Late" : "Present";
        setList((prev) => {
          const existing = prev.find((r) => r.date === today);
          if (existing) {
            return prev.map((r) => (r.date === today ? { ...r, clockIn: now, status } : r));
          }
          return [
            {
              id: `temp-${Date.now()}`,
              employeeId: "",
              employeeName,
              date: today,
              clockIn: now,
              clockOut: null,
              status,
            },
            ...prev,
          ];
        });
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Could not clock in.");
      }
    });
  }

  function doClockOut() {
    startTransition(async () => {
      try {
        await clockOut();
        const now = new Date().toISOString();
        setList((prev) => prev.map((r) => (r.date === today ? { ...r, clockOut: now } : r)));
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Could not clock out.");
      }
    });
  }

  function handleDelete(row: AttendanceRow) {
    if (!window.confirm(`Delete your attendance for ${formatDay(row.date)}?`)) return;
    startTransition(async () => {
      try {
        await deleteAttendance(row.id);
        setList((prev) => prev.filter((r) => r.id !== row.id));
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Could not delete the record.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-label-sm uppercase tracking-wider text-ink-faint">
          <span>Operations</span>
          <span>/</span>
          <span className="normal-case tracking-normal text-ink-muted">Attendance</span>
        </div>
        <h1 className="text-headline-lg text-ink md:text-headline-xl">My attendance</h1>
        <p className="text-body-md text-ink-muted">{formatDay(today)} · times shown in Lagos time (WAT)</p>
      </div>

      {/* Clock in/out card */}
      <div className="rounded-xl border border-border bg-surface p-6">
        {!hasClockIn && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-lg border border-border bg-surface-2">
                <Clock className="h-5 w-5 text-ink-faint" />
              </div>
              <div>
                <p className="text-headline-sm text-ink">You haven&apos;t clocked in yet</p>
                <p className="text-body-md text-ink-muted">Clock in to start your day. After 9:15 AM counts as late.</p>
              </div>
            </div>
            <button
              onClick={doClockIn}
              disabled={isPending}
              className="flex h-11 items-center gap-2 rounded-lg bg-accent px-5 text-label-md font-semibold text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_0_24px_-6px_var(--color-accent)] transition-colors hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-60"
            >
              <LogIn className="h-4 w-4" />
              Clock in
            </button>
          </div>
        )}

        {currentlyIn && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-good/15">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-good" />
              </div>
              <div>
                <p className="text-headline-sm text-ink">
                  Clocked in at {formatTime(todayRec!.clockIn)}
                </p>
                <p className="text-body-md text-ink-muted">
                  You&apos;re currently on the clock.
                  {todayRec!.status === "Late" && (
                    <span className="ml-1 text-warning">Marked late.</span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={doClockOut}
              disabled={isPending}
              className="flex h-11 items-center gap-2 rounded-lg border border-border bg-surface-2 px-5 text-label-md text-ink transition-colors hover:border-border-strong disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              Clock out
            </button>
          </div>
        )}

        {hasClockOut && (
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-good/15">
              <CheckCircle2 className="h-5 w-5 text-good" />
            </div>
            <div>
              <p className="text-headline-sm text-ink">You&apos;re done for today</p>
              <p className="tnum text-body-md text-ink-muted">
                In {formatTime(todayRec!.clockIn)} · Out {formatTime(todayRec!.clockOut)} ·{" "}
                {formatDuration(minutesWorked(todayRec!.clockIn, todayRec!.clockOut))} worked
              </p>
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-headline-md text-ink">Recent days</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] leading-[18px]">
            <thead>
              <tr className="border-b border-border text-label-sm uppercase tracking-[0.05em] text-ink-faint">
                <th className="px-4 py-3 font-medium sm:px-5">Date</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell sm:px-5">Clock in</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell sm:px-5">Clock out</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell sm:px-5">Hours</th>
                <th className="px-4 py-3 font-medium sm:px-5">Status</th>
                <th className="px-4 py-3 font-medium text-right sm:px-5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr
                  key={r.id}
                  className="h-12 border-b border-border last:border-0 transition-colors hover:bg-surface-2"
                >
                  <td className="px-4 py-3 font-medium text-ink sm:px-5">{formatDay(r.date)}</td>
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
                        aria-label={`Delete record for ${formatDay(r.date)}`}
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

        {list.length === 0 && (
          <div className="grid place-items-center py-12 text-center">
            <p className="text-body-md text-ink-muted">No attendance history yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
