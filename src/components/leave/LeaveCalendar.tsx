"use client";

import { ChevronLeft, ChevronRight, ChevronDown, Table2 } from "lucide-react";
import { LEAVE_TYPES, leaveStyle, formatLeaveRange, type LeaveRow } from "@/lib/leave";
import Avatar from "./Avatar";

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
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 items-center gap-1 rounded-full border border-border bg-surface pl-1 pr-1">
            <button onClick={() => step(-1)} aria-label="Previous month" className="grid h-7 w-7 place-items-center rounded-full text-ink-muted hover:bg-bg hover:text-ink">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-32 text-center font-display text-label-md font-semibold text-ink">{monthLabel}</span>
            <button onClick={() => step(1)} aria-label="Next month" className="grid h-7 w-7 place-items-center rounded-full text-ink-muted hover:bg-bg hover:text-ink">
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => onMonthChange(todayMonth)}
              disabled={month === todayMonth}
              className="h-7 rounded-full bg-surface-2 px-3 text-label-sm font-semibold text-ink transition-colors hover:bg-bg disabled:opacity-50"
            >
              Today
            </button>
          </div>

          {departments.length > 1 && (
            <label className="relative">
              <span className="sr-only">Department</span>
              <select
                value={dept}
                onChange={(e) => onDeptChange(e.target.value)}
                className="h-9 appearance-none rounded-full border border-border bg-surface pl-4 pr-9 text-label-md text-ink outline-none transition-colors hover:bg-bg focus:border-ink"
              >
                <option value="all">All departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            </label>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-label-sm text-ink-muted">
          {LEAVE_TYPES.map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className={`h-3 w-3 rounded-sm ${leaveStyle(t).dot}`} />
              {t}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-sm border border-dashed border-ink-muted" />
            Pending
          </span>
        </div>
      </div>

      {/* ── Title strip ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-bg px-4 py-3">
        <p className="flex items-center gap-2 text-body-md text-ink">
          <Table2 className="h-4 w-4 text-ink-muted" />
          <span className="font-display font-semibold">{monthLabel.split(" ")[0]} timeline</span>
          <span className="text-ink-muted">({formatLeaveRange(monthStart, monthEnd)})</span>
        </p>
        {todayMonth === month && (
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink">
            <span className="h-2 w-2 rounded-full bg-accent ring-1 ring-ink/30" />
            Today · {formatLeaveRange(today, today)}
          </span>
        )}
      </div>

      {/* ── Grid — scrolls sideways inside its own box on narrow screens ── */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: 180 + daysInMonth * 30 }}>
          {/* Header: "Team member" + one cell per day */}
          <div className="grid border-b border-border" style={{ gridTemplateColumns: gridCols }}>
            <div className="sticky left-0 z-20 flex items-center bg-surface px-4 py-2 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
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

          {rows.length === 0 && (
            <p className="px-4 py-14 text-center text-body-md text-ink-muted">Nobody has time off booked in {monthLabel}.</p>
          )}
        </div>
      </div>

      <div className="border-t border-border bg-bg px-4 py-2.5 text-body-sm text-ink-muted">
        Pending requests have a dashed outline. Declined requests are hidden from the timeline.
      </div>
    </section>
  );
}
