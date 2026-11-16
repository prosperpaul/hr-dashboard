"use client";

import { useMemo, useState, useTransition } from "react";
import { LogIn, LogOut, Clock, CheckCircle2, Trash2 } from "lucide-react";
import {
  formatTime,
  formatDuration,
  formatDay,
  minutesWorked,
  isLate,
  minutesLate,
  minutesOfDay,
  LATE_AFTER_LABEL,
  type AttendanceRow,
} from "@/lib/attendance";
import { clockIn, clockOut, deleteAttendance } from "@/lib/attendance-actions";
import AttendanceStatusBadge from "./AttendanceStatusBadge";

const CAPS = "text-[11px] font-bold uppercase tracking-[0.06em]";

// 534 (minutes after midnight) → "8:54 AM".
const minutesLabel = (m: number) => {
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

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

  // ── Personal stats from your 30 most recent records (all real data) ──
  const recent = list.slice(0, 30);
  const inOffice = recent.filter((r) => (r.status === "Present" || r.status === "Late") && r.clockIn);
  const onTimeRate = inOffice.length
    ? Math.round((inOffice.filter((r) => r.status === "Present").length / inOffice.length) * 100)
    : null;
  const durations = recent.map((r) => minutesWorked(r.clockIn, r.clockOut)).filter((m): m is number => m !== null);
  const avgWorked = durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;
  const arrivals = inOffice.map((r) => minutesOfDay(r.clockIn!));
  const avgArrival = arrivals.length ? Math.round(arrivals.reduce((a, b) => a + b, 0) / arrivals.length) : null;
  const firstName = employeeName.split(" ")[0];

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
      {/* ── Editorial header ── */}
      <header className="border-b border-border pb-6">
        <div className={`mb-1.5 flex flex-wrap items-center gap-1.5 ${CAPS} text-ink-muted`}>
          <span>Operations</span>
          <span className="text-ink-faint">•</span>
          <span className="text-ink">My attendance</span>
        </div>
        <h1 className="text-headline-lg text-ink md:text-headline-xl">
          {hasClockOut
            ? `That’s a wrap, ${firstName}.`
            : currentlyIn
              ? `You’re on the clock, ${firstName}.`
              : `Good to see you, ${firstName}.`}
        </h1>
        <p className="mt-1 text-body-md text-ink-muted">
          {formatDay(today)} · after {LATE_AFTER_LABEL} counts as late · times in Lagos time (WAT)
        </p>
      </header>

      {/* ── Navy clock-in / clock-out band ── */}
      <section className="rounded-xl bg-navy p-5 text-on-navy md:p-6">
        <div className="mb-4 flex items-center gap-3 border-b border-navy-line pb-4">
          <span className="relative flex h-3 w-3">
            {currentlyIn && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />}
            <span className={`relative inline-flex h-3 w-3 rounded-full ${currentlyIn ? "bg-accent" : "bg-on-navy-muted"}`} />
          </span>
          <span className={`${CAPS} text-on-navy-muted`}>Today · {formatDay(today)}</span>
        </div>

        {!hasClockIn && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-navy-2">
                <Clock className="h-5 w-5 text-on-navy-muted" />
              </div>
              <div>
                <p className="font-display text-headline-md text-on-navy">You haven&apos;t clocked in yet</p>
                <p className="text-body-md text-on-navy-muted">Clock in to start your day. After {LATE_AFTER_LABEL} counts as late.</p>
              </div>
            </div>
            <button
              onClick={doClockIn}
              disabled={isPending}
              className="flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-label-md font-semibold text-on-accent transition-colors hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-60"
            >
              <LogIn className="h-4 w-4" />
              Clock in
            </button>
          </div>
        )}

        {currentlyIn && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="tnum font-display text-[44px] font-bold leading-none">{formatTime(todayRec!.clockIn)}</span>
              <span className="text-headline-sm text-on-navy-muted">clocked in</span>
              {todayRec!.status === "Late" && todayRec!.clockIn && (
                <span className={`rounded bg-accent px-2 py-0.5 ${CAPS} text-on-accent`}>Late +{minutesLate(todayRec!.clockIn)}m</span>
              )}
            </div>
            <button
              onClick={doClockOut}
              disabled={isPending}
              className="flex h-11 items-center gap-2 rounded-full bg-on-navy px-6 text-label-md font-semibold text-navy transition-colors hover:bg-on-navy-muted disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              Clock out
            </button>
          </div>
        )}

        {hasClockOut && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-navy-2">
              <CheckCircle2 className="h-5 w-5 text-[#f5c518]" />
            </div>
            <div>
              <p className="font-display text-headline-md text-on-navy">You&apos;re done for today</p>
              <p className="tnum text-body-md text-on-navy-muted">
                In {formatTime(todayRec!.clockIn)} · Out {formatTime(todayRec!.clockOut)} ·{" "}
                {formatDuration(minutesWorked(todayRec!.clockIn, todayRec!.clockOut))} worked
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ── Personal stats (from your most recent records) ── */}
      <section className="grid grid-cols-1 gap-x-4 gap-y-5 rounded-xl border border-border bg-surface px-5 py-4 sm:grid-cols-3">
        <div>
          <p className={`${CAPS} text-ink-muted`}>On-time rate</p>
          <p className="tnum mt-1 text-metric-md text-ink">{onTimeRate !== null ? `${onTimeRate}%` : "—"}</p>
          <p className="text-body-sm text-ink-muted">of office check-ins, last {recent.length} days on record</p>
        </div>
        <div>
          <p className={`${CAPS} text-ink-muted`}>Avg arrival</p>
          <p className="tnum mt-1 text-metric-md text-ink">{avgArrival !== null ? minutesLabel(avgArrival) : "—"}</p>
          <p className="text-body-sm text-ink-muted">cut-off {LATE_AFTER_LABEL}</p>
        </div>
        <div>
          <p className={`${CAPS} text-ink-muted`}>Avg day</p>
          <p className="tnum mt-1 text-metric-md text-ink">{formatDuration(avgWorked)}</p>
          <p className="text-body-sm text-ink-muted">from completed clock-outs</p>
        </div>
      </section>

      {/* ── History ── */}
      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-headline-md text-ink">Recent days</h2>
          <span className="tnum text-body-sm text-ink-muted">
            {list.length} {list.length === 1 ? "record" : "records"}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] leading-[18px]">
            <thead>
              <tr className={`border-b border-border bg-bg ${CAPS} text-ink-muted`}>
                <th className="px-4 py-3 sm:px-5">Date</th>
                <th className="hidden px-4 py-3 sm:table-cell sm:px-5">Clock in</th>
                <th className="hidden px-4 py-3 md:table-cell sm:px-5">Clock out</th>
                <th className="hidden px-4 py-3 lg:table-cell sm:px-5">Hours</th>
                <th className="px-4 py-3 sm:px-5">Status</th>
                <th className="px-4 py-3 text-right sm:px-5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="h-12 border-b border-border transition-colors last:border-0 hover:bg-bg">
                  <td className="px-4 py-3 font-semibold text-ink sm:px-5">{formatDay(r.date)}</td>
                  <td className="tnum hidden px-4 py-3 text-ink-muted sm:table-cell sm:px-5">{formatTime(r.clockIn)}</td>
                  <td className="tnum hidden px-4 py-3 text-ink-muted md:table-cell sm:px-5">{formatTime(r.clockOut)}</td>
                  <td className="tnum hidden px-4 py-3 text-ink-muted lg:table-cell sm:px-5">
                    {formatDuration(minutesWorked(r.clockIn, r.clockOut))}
                  </td>
                  <td className="px-4 py-3 sm:px-5">
                    <AttendanceStatusBadge
                      status={r.status}
                      note={r.status === "Late" && r.clockIn ? `+${minutesLate(r.clockIn)}m` : undefined}
                    />
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => handleDelete(r)}
                        aria-label={`Delete record for ${formatDay(r.date)}`}
                        className="grid h-8 w-8 place-items-center rounded-full text-ink-muted transition-colors hover:bg-critical/10 hover:text-critical"
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
      </section>
    </div>
  );
}
