"use client";

import { ChevronLeft, ChevronRight, ChevronDown, Table2 } from "lucide-react";
import { LEAVE_TYPES, leaveStyle, formatLeaveRange, type LeaveRow } from "@/lib/leave";
import Avatar from "./Avatar";
import StatusText from "@/components/ui/StatusText";

const WEEKDAY = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const LANE_HEIGHT = 30; // px per stacked bar inside one person's row

// "2026-11" + 5 → "2026-11-05"
const dayKey = (ym: string, d: number) => `${ym}-${String(d).padStart(2, "0")}`;

/*
  Month TIMELINE of time off ("Gantt" style).

  How it works:
  - One row per person who has (non-rejected) leave touching the shown month.
  - One column per day of the month. A leave request becomes a coloured bar
    that starts in its first day's column and spans to its last day's column
    (clamped to the month edges).
  - If one person has two requests that overlap, the second one drops to a
    new "lane" (a second line inside their row) so the bars never cover each other.
  Dates are "YYYY-MM-DD" strings, so plain string comparison works for
  "is this date between start and end".

  The shown month and department filter live in LeaveManager (so the tab
  counts above can use them); this component just reports changes.

  Phones: a 30-column grid can't fit a 360px screen, so below md we show
  the SAME people and requests as an agenda list instead (one card per
  person, one line per request). The timeline grid appears from md up.
*/
export default function LeaveCalendar({
  requests,
  departments,
  today,
  month,
  onMonthChange,
  dept,
  onDeptChange,
}: {
  requests: LeaveRow[]; // already filtered by department
  departments: string[]; // for the filter; empty hides it
  today: string; // "YYYY-MM-DD"
  month: string; // "YYYY-MM" being shown
  onMonthChange: (month: string) => void;
  dept: string;
  onDeptChange: (dept: string) => void;
}) {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate(); // day 0 of next month = last day of this one
  const monthStart = dayKey(month, 1);
  const monthEnd = dayKey(month, daysInMonth);
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const todayMonth = today.slice(0, 7);

  // Move the shown month by n (−1 = previous, +1 = next).
  const step = (n: number) => {
    const d = new Date(y, m - 1 + n, 1);
    onMonthChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  // Every day of the month, with its weekday and whether it's a weekend.
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(y, m - 1, i + 1);
    const key = dayKey(month, i + 1);
    return { n: i + 1, key, weekday: WEEKDAY[date.getDay()], weekend: date.getDay() === 0 || date.getDay() === 6, isToday: key === today };
  });

  // Requests that touch this month (rejected ones are never shown).
  const inMonth = requests.filter((r) => r.status !== "Rejected" && r.startDate <= monthEnd && r.endDate >= monthStart);

  // Group by person, then give each request a lane so overlaps stack.
  const people = new Map<string, { name: string; department: string | null; bars: { r: LeaveRow; lane: number }[]; lanes: number }>();
  for (const r of [...inMonth].sort((a, b) => a.startDate.localeCompare(b.startDate))) {
    const p = people.get(r.employeeId) ?? { name: r.employeeName, department: r.department, bars: [], lanes: 0 };
    // First lane whose last bar ends before this one starts.
    let lane = 0;
    while (p.bars.some((b) => b.lane === lane && b.r.endDate >= r.startDate)) lane++;
    p.bars.push({ r, lane });
    p.lanes = Math.max(p.lanes, lane + 1);
    people.set(r.employeeId, p);
  }
  const rows = [...people.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));

  // Column number (1-based) of a date inside the month, clamped to the edges.
  const colOf = (date: string) => (date < monthStart ? 1 : date > monthEnd ? daysInMonth : Number(date.slice(8, 10)));

  // Shared grid template: a name column, then one column per day.
  const gridCols = `minmax(150px, 200px) repeat(${daysInMonth}, minmax(30px, 1fr))`;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        {/* Month stepper: full width with 48px buttons on phones, a compact pill from md up */}
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          <div className="flex w-full items-center gap-1 rounded-full border border-border bg-surface p-1 lg:h-9 md:w-auto md:p-0 md:px-1">
            <button
              onClick={() => step(-1)}
              aria-label="Previous month"
              className="grid size-tap shrink-0 place-items-center rounded-full text-ink-muted hover:bg-bg hover:text-ink lg:size-7"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <span aria-live="polite" className="min-w-0 flex-1 truncate text-center font-display text-label-md font-semibold text-ink md:min-w-32 md:flex-none">
              {monthLabel}
            </span>
            <button
              onClick={() => step(1)}
              aria-label="Next month"
              className="grid size-tap shrink-0 place-items-center rounded-full text-ink-muted hover:bg-bg hover:text-ink lg:size-7"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
            <button
              onClick={() => onMonthChange(todayMonth)}
              disabled={month === todayMonth}
              className="min-h-tap shrink-0 rounded-full bg-surface-2 px-4 text-label-sm font-semibold text-ink transition-colors hover:bg-bg disabled:opacity-50 lg:h-7 lg:min-h-0 md:px-3"
            >
              Today
            </button>
          </div>

          {departments.length > 1 && (
            <label className="relative w-full md:w-auto">
              <span className="sr-only">Department</span>
              <select
                value={dept}
                onChange={(e) => onDeptChange(e.target.value)}
                className="min-h-tap w-full appearance-none rounded-full border border-border bg-surface pl-4 pr-9 text-label-md text-ink outline-none transition-colors hover:bg-bg focus:border-ink lg:h-9 lg:min-h-0 md:w-auto"
              >
                <option value="all">All departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            </label>
          )}
        </div>

        {/* Legend — explains the timeline bar colours, so it's hidden on phones
            where the agenda spells out each leave type and status in words */}
        <div className="hidden flex-wrap items-center gap-x-4 gap-y-1.5 text-label-sm text-ink-muted md:flex">
          {LEAVE_TYPES.map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span aria-hidden className={`h-3 w-3 rounded-sm ${leaveStyle(t).dot}`} />
              {t}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 rounded-sm border border-dashed border-ink-muted" />
            Pending
          </span>
        </div>
      </div>

      {/* ── Title strip ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-bg px-4 py-3">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-body-md text-ink">
          <Table2 className="h-4 w-4 text-ink-muted" aria-hidden />
          <span className="font-display font-semibold">
            {monthLabel.split(" ")[0]} <span className="md:hidden">agenda</span>
            <span className="hidden md:inline">timeline</span>
          </span>
          <span className="text-ink-muted">({formatLeaveRange(monthStart, monthEnd)})</span>
        </p>
        {todayMonth === month && (
          <span className="flex items-center gap-1.5 text-eyebrow uppercase text-ink">
            <span aria-hidden className="h-2 w-2 rounded-full bg-accent ring-1 ring-ink/30" />
            Today · {formatLeaveRange(today, today)}
          </span>
        )}
      </div>

      {/* ── Phones: agenda list (same data as the grid below) ── */}
      {rows.length > 0 && (
        <ul aria-label={`Time off in ${monthLabel}`} className="divide-y divide-border md:hidden">
          {rows.map(([id, p]) => (
            <li key={id} className="min-w-0 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={p.name} department={p.department} size={36} />
                <div className="min-w-0">
                  <p className="truncate font-display text-label-md font-semibold text-ink">{p.name}</p>
                  <p className="truncate text-body-sm text-ink-muted">{p.department ?? "No department"}</p>
                </div>
              </div>
              <ul className="mt-2 space-y-2">
                {p.bars.map(({ r }) => {
                  const offToday = r.startDate <= today && r.endDate >= today;
                  return (
                    <li
                      key={r.id}
                      className={`flex min-w-0 items-start justify-between gap-3 rounded-lg border p-3 ${
                        offToday ? "border-accent bg-accent-soft" : "border-border bg-bg"
                      }`}
                    >
                      <div className="min-w-0">
                        <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-label-sm font-semibold ${leaveStyle(r.type).chip}`}>
                          {r.type}
                        </span>
                        <p className="mt-1.5 text-body-md font-semibold text-ink">{formatLeaveRange(r.startDate, r.endDate)}</p>
                        <p className="tnum text-body-sm text-ink-muted">
                          {r.days} {r.days === 1 ? "day" : "days"}
                          {offToday ? " · off today" : ""}
                        </p>
                      </div>
                      <StatusText tone={r.status === "Approved" ? "good" : "pending"} className="shrink-0 pt-0.5">
                        {r.status}
                      </StatusText>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {/* ── md and up: the timeline grid (scrolls sideways in its own box on a narrow tablet) ── */}
      <div className="hidden overflow-x-auto md:block">
        <div style={{ minWidth: 180 + daysInMonth * 30 }}>
          {/* Header: "Team member" + one cell per day */}
          <div className="grid border-b border-border" style={{ gridTemplateColumns: gridCols }}>
            <div className="sticky left-0 z-20 flex items-center bg-surface px-4 py-2 text-eyebrow uppercase text-ink-muted">
              Team member ({rows.length})
            </div>
            {days.map((d) => (
              <div
                key={d.key}
                className={`border-l border-border py-2 text-center leading-tight ${d.isToday ? "bg-accent-soft" : d.weekend ? "bg-bg" : ""}`}
              >
                <span className={`tnum block text-label-sm ${d.isToday ? "font-bold text-ink" : "text-ink-muted"}`}>{d.n}</span>
                <span className="block text-[9px] font-bold uppercase tracking-[0.06em] text-ink-faint">{d.weekday}</span>
              </div>
            ))}
          </div>

          {/* One row per person */}
          {rows.map(([id, p]) => (
            <div key={id} className="grid border-b border-border last:border-b-0" style={{ gridTemplateColumns: gridCols }}>
              <div className="sticky left-0 z-20 flex items-center gap-2.5 bg-surface px-4 py-2.5">
                <Avatar name={p.name} department={p.department} size={30} />
                <div className="min-w-0">
                  <p className="truncate font-display text-label-md font-semibold text-ink">{p.name}</p>
                  <p className="truncate text-body-sm text-ink-muted">{p.department ?? "No department"}</p>
                </div>
              </div>

              {/* The day columns for this person: background cells + bars on top */}
              <div
                className="grid py-2.5"
                style={{
                  gridColumn: "2 / -1",
                  gridTemplateColumns: `repeat(${daysInMonth}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${p.lanes}, ${LANE_HEIGHT}px)`,
                  rowGap: 4,
                }}
              >
                {days.map((d) => (
                  <div
                    key={d.key}
                    className={`-my-2.5 border-l border-border ${d.isToday ? "bg-accent-soft" : d.weekend ? "bg-bg" : ""}`}
                    style={{ gridColumn: d.n, gridRow: "1 / -1" }}
                  />
                ))}
                {p.bars.map(({ r, lane }) => {
                  const from = colOf(r.startDate);
                  const to = colOf(r.endDate);
                  return (
                    <div
                      key={r.id}
                      title={`${r.employeeName} · ${r.type} · ${formatLeaveRange(r.startDate, r.endDate)}${r.status === "Pending" ? " (pending)" : ""}`}
                      className={[
                        "relative z-10 mx-0.5 flex items-center overflow-hidden rounded-md border px-2 text-[11px] font-semibold",
                        leaveStyle(r.type).chip,
                        r.status === "Pending" ? "border-dashed border-ink/40" : "",
                      ].join(" ")}
                      style={{ gridColumn: `${from} / ${to + 1}`, gridRow: lane + 1 }}
                    >
                      <span className="truncate">{to - from >= 1 ? r.type : ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

        </div>
      </div>

      {/* Empty month — shared by the agenda and the grid */}
      {rows.length === 0 && (
        <p className="px-4 py-10 text-center text-body-md text-ink-muted md:py-14">Nobody has time off booked in {monthLabel}.</p>
      )}

      <div className="border-t border-border bg-bg px-4 py-2.5 text-body-sm text-ink-muted">
        <span className="hidden md:inline">Pending requests have a dashed outline. </span>
        Declined requests are hidden from the <span className="md:hidden">agenda</span>
        <span className="hidden md:inline">timeline</span>.
      </div>
    </section>
  );
}
