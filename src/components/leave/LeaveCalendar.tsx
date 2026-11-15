"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { LEAVE_TYPES, leaveStyle, type LeaveRow } from "@/lib/leave";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_CHIPS = 2; // per day cell; the rest collapse into "+N more"

// Local "YYYY-MM-DD" for a date.
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const firstName = (name: string) => {
  const [first, last] = name.split(" ");
  return last ? `${first} ${last[0]}.` : first;
};

/*
  Month calendar of time off.

  How the grid is built: find the Monday on/before the 1st of the month,
  then lay out 6 weeks × 7 days from there. For each day we show every
  request whose start..end range covers it. Because dates are stored as
  "YYYY-MM-DD" strings, plain string comparison works for "is between".
*/
export default function LeaveCalendar({
  requests,
  departments,
  today,
}: {
  requests: LeaveRow[];
  departments: string[]; // for the filter; empty hides it
  today: string;
}) {
  const [ty, tm] = today.split("-").map(Number);
  const [month, setMonth] = useState(() => new Date(ty, tm - 1, 1)); // 1st of the shown month
  const [dept, setDept] = useState("all");

  // Rejected requests never show; filter by department if chosen.
  const shown = requests.filter((r) => r.status !== "Rejected" && (dept === "all" || r.department === dept));

  // Monday-first offset: getDay() is 0=Sun..6=Sat → 0=Mon..6=Sun.
  const lead = (month.getDay() + 6) % 7;
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - lead);
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  // Drop the 6th week if it's entirely next month.
  const cells = days[35].getMonth() !== month.getMonth() ? days.slice(0, 35) : days;

  const step = (n: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + n, 1));

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-surface-2">
            <button onClick={() => step(-1)} aria-label="Previous month" className="grid h-8 w-8 place-items-center text-ink-muted hover:text-ink">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-36 text-center text-headline-sm text-ink">
              {month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
            <button onClick={() => step(1)} aria-label="Next month" className="grid h-8 w-8 place-items-center text-ink-muted hover:text-ink">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => setMonth(new Date(ty, tm - 1, 1))}
            className="h-8 rounded-lg border border-border bg-surface-2 px-2.5 text-label-sm text-ink-muted transition-colors hover:border-border-strong hover:text-ink"
          >
            Today
          </button>
        </div>

        {departments.length > 1 && (
          <select
            aria-label="Department"
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            className="h-8 rounded-lg border border-border bg-surface-2 px-2.5 text-label-sm text-ink outline-none transition-colors hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent"
          >
            <option value="all">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border border-border bg-bg/50 px-3 py-2 text-label-sm text-ink-muted">
        <span className="uppercase tracking-wider text-ink-faint">Legend</span>
        {LEAVE_TYPES.map((t) => (
          <span key={t} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${leaveStyle(t).dot}`} />
            {t}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm border border-dashed border-ink-faint" />
          Pending
        </span>
      </div>

      {/* Grid — scrolls sideways on narrow screens instead of squashing */}
      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[640px] overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-7 border-b border-border bg-bg/50">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2 text-center text-label-sm uppercase tracking-wider text-ink-faint">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {cells.map((day, i) => {
              const key = ymd(day);
              const inMonth = day.getMonth() === month.getMonth();
              const weekend = i % 7 >= 5;
              const isToday = key === today;
              const events = inMonth ? shown.filter((r) => r.startDate <= key && r.endDate >= key) : [];

              return (
                <div
                  key={key}
                  className={[
                    "min-h-24 border-b border-r border-border p-1.5 [&:nth-child(7n)]:border-r-0",
                    weekend || !inMonth ? "bg-bg/40" : "",
                    isToday ? "relative ring-1 ring-inset ring-accent/60" : "",
                  ].join(" ")}
                >
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className={`tnum text-label-sm ${inMonth ? (weekend ? "text-ink-faint" : "text-ink-muted") : "text-ink-faint/50"}`}>
                      {day.getDate()}
                    </span>
                    {isToday && <span className="rounded bg-accent px-1 text-[9px] font-semibold uppercase text-on-accent">Today</span>}
                  </div>

                  <div className="space-y-1">
                    {events.slice(0, MAX_CHIPS).map((r) => (
                      <div
                        key={r.id}
                        title={`${r.employeeName} · ${r.type}${r.status === "Pending" ? " (pending)" : ""}`}
                        className={[
                          "flex items-center gap-1 truncate rounded border px-1.5 py-0.5 text-[10px] leading-tight",
                          leaveStyle(r.type).chip,
                          r.status === "Pending" ? "border-dashed opacity-70" : "",
                        ].join(" ")}
                      >
                        <span className={`h-1 w-1 shrink-0 rounded-full ${leaveStyle(r.type).dot}`} />
                        <span className="truncate">{firstName(r.employeeName)}</span>
                      </div>
                    ))}
                    {events.length > MAX_CHIPS && (
                      <div className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-faint">+{events.length - MAX_CHIPS} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
