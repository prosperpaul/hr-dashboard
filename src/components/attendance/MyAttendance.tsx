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
import AttendanceStatusBadge, { AttendanceStatusText } from "./AttendanceStatusBadge";
import ResponsiveList from "@/components/ui/ResponsiveList";
import ListRow from "@/components/ui/ListRow";
import EmptyState from "@/components/ui/EmptyState";
import LiveMessage from "@/components/ui/LiveMessage";
import ConfirmSheet, { type Confirmation } from "@/components/employees/ConfirmSheet";

const CAPS = "text-eyebrow uppercase";

// 534 (minutes after midnight) → "8:54 AM".
const minutesLabel = (m: number) => {
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

// "+12m" for a late day, nothing otherwise.
const lateNote = (r: AttendanceRow) => (r.status === "Late" && r.clockIn ? `+${minutesLate(r.clockIn)}m` : undefined);

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
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [message, setMessage] = useState("");

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
    setConfirmation({
      title: "Delete this record?",
      message: `Delete your attendance for ${formatDay(row.date)}? This can't be undone.`,
      confirmLabel: "Delete record",
      danger: true,
      onConfirm: () => {
        setMessage("");
        startTransition(async () => {
          try {
            await deleteAttendance(row.id);
            setList((prev) => prev.filter((r) => r.id !== row.id));
            setMessage("Record deleted");
          } catch (err) {
            window.alert(err instanceof Error ? err.message : "Could not delete the record.");
          }
        });
      },
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

        {/* Phones: message on top, then a big full-width button for the thumb.
            sm+: message and button side by side. */}
        {!hasClockIn && (
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-navy-2">
                <Clock className="h-5 w-5 text-on-navy-muted" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="font-display text-headline-md text-on-navy">You haven&apos;t clocked in yet</p>
                <p className="text-body-md text-on-navy-muted">Clock in to start your day. After {LATE_AFTER_LABEL} counts as late.</p>
              </div>
            </div>
            <button
              onClick={doClockIn}
              disabled={isPending}
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 text-body-lg font-semibold text-on-accent transition-colors hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-60 sm:w-auto lg:h-11 lg:min-h-0 lg:text-label-md"
            >
              <LogIn className="h-5 w-5 lg:h-4 lg:w-4" aria-hidden />
              Clock in
            </button>
          </div>
        )}

        {currentlyIn && (
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
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
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-on-navy px-6 text-body-lg font-semibold text-navy transition-colors hover:bg-on-navy-muted disabled:opacity-60 sm:w-auto lg:h-11 lg:min-h-0 lg:text-label-md"
            >
              <LogOut className="h-5 w-5 lg:h-4 lg:w-4" aria-hidden />
              Clock out
            </button>
          </div>
        )}

        {hasClockOut && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-navy-2">
              <CheckCircle2 className="h-5 w-5 text-[#f5c518]" aria-hidden />
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
      {/* Phones: two side by side, the third across the bottom; sm+: three in a row. */}
      <section className="grid grid-cols-2 gap-x-4 gap-y-5 rounded-xl border border-border bg-surface p-4 sm:grid-cols-3 sm:px-5">
        <div className="min-w-0">
          <p className={`${CAPS} text-ink-muted`}>On-time rate</p>
          <p className="tnum mt-1 text-metric-md text-ink">{onTimeRate !== null ? `${onTimeRate}%` : "—"}</p>
          <p className="text-body-sm text-ink-muted">of office check-ins, last {recent.length} days on record</p>
        </div>
        <div className="min-w-0">
          <p className={`${CAPS} text-ink-muted`}>Avg arrival</p>
          <p className="tnum mt-1 text-metric-md text-ink">{avgArrival !== null ? minutesLabel(avgArrival) : "—"}</p>
          <p className="text-body-sm text-ink-muted">cut-off {LATE_AFTER_LABEL}</p>
        </div>
        <div className="col-span-2 min-w-0 border-t border-border pt-4 sm:col-span-1 sm:border-0 sm:pt-0">
          <p className={`${CAPS} text-ink-muted`}>Avg day</p>
          <p className="tnum mt-1 text-metric-md text-ink">{formatDuration(avgWorked)}</p>
          <p className="text-body-sm text-ink-muted">from completed clock-outs</p>
        </div>
      </section>

      {/* ── History ── */}
      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 md:px-5">
          <h2 className="text-headline-md text-ink">Recent days</h2>
          <span className="tnum shrink-0 text-body-sm text-ink-muted">
            {list.length} {list.length === 1 ? "record" : "records"}
          </span>
        </div>
        {/* md+: a table. Phones: one row per day (date, times, status words + a delete button). */}
        <ResponsiveList
          caption="Your attendance history"
          rows={list}
          getKey={(r) => r.id}
          inset
          listClassName="px-4"
          tableClassName="[&_table]:text-body-sm [&_thead_tr]:bg-bg"
          columns={[
            { key: "date", header: "Date", className: "font-semibold text-ink", cell: (r) => formatDay(r.date) },
            { key: "in", header: "Clock in", className: "tnum text-ink-muted", cell: (r) => formatTime(r.clockIn) },
            { key: "out", header: "Clock out", className: "tnum text-ink-muted", cell: (r) => formatTime(r.clockOut) },
            {
              key: "hours",
              header: "Hours",
              className: "tnum text-ink-muted",
              cell: (r) => formatDuration(minutesWorked(r.clockIn, r.clockOut)),
            },
            {
              key: "status",
              header: "Status",
              cell: (r) => <AttendanceStatusBadge status={r.status} note={lateNote(r)} />,
            },
            {
              key: "actions",
              header: "Actions",
              align: "right",
              cell: (r) => (
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => handleDelete(r)}
                    disabled={isPending}
                    aria-label={`Delete record for ${formatDay(r.date)}`}
                    className="relative grid h-8 w-8 place-items-center rounded-full text-ink-muted transition-colors before:absolute before:-inset-2 before:content-[''] hover:bg-critical/10 hover:text-critical lg:before:hidden"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ),
            },
          ]}
          renderRow={(r) => (
            <div className="flex min-w-0 items-center gap-1">
              <ListRow
                className="min-w-0 flex-1"
                title={formatDay(r.date)}
                subtitle={
                  r.clockIn
                    ? `${formatTime(r.clockIn)} → ${r.clockOut ? `${formatTime(r.clockOut)} · ${formatDuration(minutesWorked(r.clockIn, r.clockOut))}` : "no clock-out"}`
                    : "No clock-in"
                }
                trailing={<AttendanceStatusText status={r.status} note={lateNote(r)} variant="pill" />}
              />
              <button
                onClick={() => handleDelete(r)}
                disabled={isPending}
                aria-label={`Delete record for ${formatDay(r.date)}`}
                className="grid size-tap shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-critical/10 hover:text-critical"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          )}
          empty={<EmptyState icon={Clock} title="No attendance history yet" description="Your clock-ins will show up here." />}
        />
      </section>

      <ConfirmSheet confirmation={confirmation} onClose={() => setConfirmation(null)} />
      <LiveMessage message={message} />
    </div>
  );
}
