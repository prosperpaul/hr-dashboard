"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Clock, ChevronLeft, ChevronRight, CalendarDays, Search, Download, BarChart3 } from "lucide-react";
import { initialsOf } from "@/lib/sample-data";
import {
  formatTime,
  formatDuration,
  formatDay,
  minutesWorked,
  minutesLate,
  LATE_AFTER_LABEL,
  type AttendanceRow,
} from "@/lib/attendance";
import { deleteAttendance } from "@/lib/attendance-actions";
import StatCard, { type DashStat } from "@/components/dashboard/StatCard";
import { Pill } from "@/components/dashboard/Panel";
import AttendanceStatusBadge, { attendanceDot } from "./AttendanceStatusBadge";

export type AttendanceEmployee = {
  id: string;
  name: string;
  role: string;
  email: string;
  startedAt: string;
  department: string | null;
};

// One line in the daily log: an employee + their record for the day (if any).
type DayRow = { emp: AttendanceEmployee; rec: AttendanceRow | null; status: string };

const STATUS_FILTERS = ["All", "Present", "Late", "Remote", "Absent", "No record"] as const;
const PAGE_SIZES = [8, 16, 32];
const FULL_DAY = 8 * 60; // 8h — scale for the duration bar

// Dates are "YYYY-MM-DD" strings; these helpers move between days safely.
const parseDay = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addDays = (s: string, n: number) => {
  const d = parseDay(s);
  return ymd(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};

export default function AttendanceManager({
  records,
  employees,
  today,
}: {
  records: AttendanceRow[];
  employees: AttendanceEmployee[];
  today: string; // business-time-zone "YYYY-MM-DD", decided on the server
}) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [dept, setDept] = useState("all");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(8);
  const [isPending, startTransition] = useTransition();

  // Fast lookup: "employeeId|date" → record.
  const byKey = new Map(records.map((r) => [`${r.employeeId}|${r.date}`, r]));

  // Everyone employed on a given day, with their record (or none).
  function rowsFor(day: string): DayRow[] {
    return employees
      .filter((e) => e.startedAt <= day)
      .map((emp) => {
        const rec = byKey.get(`${emp.id}|${day}`) ?? null;
        return { emp, rec, status: rec?.status ?? "No record" };
      });
  }
  const tally = (rows: DayRow[]) => {
    const c: Record<string, number> = { Present: 0, Late: 0, Remote: 0, Absent: 0, "No record": 0 };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  };

  const dayRows = rowsFor(date);
  const c = tally(dayRows);
  const headcount = dayRows.length;
  const present = c.Present + c.Late; // physically checked in
  const pct = (n: number) => (headcount ? Math.round((n / headcount) * 1000) / 10 : 0);
  const prev = tally(rowsFor(addDays(date, -1)));
  const presentDiff = present - (prev.Present + prev.Late);
  const lateDelays = dayRows.filter((r) => r.status === "Late" && r.rec?.clockIn).map((r) => minutesLate(r.rec!.clockIn!));
  const avgDelay = lateDelays.length ? Math.round(lateDelays.reduce((s, n) => s + n, 0) / lateDelays.length) : 0;

  const stats: DashStat[] = [
    {
      key: "present",
      label: date === today ? "Present today" : "Present",
      value: String(present),
      side: <span className="mb-1 mr-auto ml-1.5 text-body-sm text-ink-faint">/ {headcount} staff</span>,
      badge: presentDiff !== 0 ? { text: `${presentDiff > 0 ? "+" : "−"}${Math.abs(presentDiff)} vs prev day`, trend: presentDiff > 0 ? "up" : "down" } : undefined,
      bar: [
        { value: present, className: "bg-accent" },
        { value: Math.max(headcount - present, 0), className: "bg-transparent" },
      ],
      footer: { label: "Attendance rate", value: `${pct(present + c.Remote)}%`, accent: true },
    },
    {
      key: "late",
      label: "Late arrivals",
      value: String(c.Late),
      badge: c.Late > 0 ? { text: "Requires check", tone: "neutral" } : undefined,
      side: <span className="mb-1 mr-auto ml-1.5 text-body-sm text-ink-faint">after {LATE_AFTER_LABEL}</span>,
      bar: [
        { value: c.Late, className: "bg-warning" },
        { value: Math.max(headcount - c.Late, 0), className: "bg-transparent" },
      ],
      footer: { label: "Average delay", value: lateDelays.length ? `${avgDelay} min` : "—" },
    },
    {
      key: "absent",
      label: "Absent / not in",
      value: String(c.Absent + c["No record"]),
      badge: { text: `${pct(c.Absent + c["No record"])}% of staff`, tone: "neutral" },
      bar: [
        { value: c.Absent, className: "bg-critical" },
        { value: c["No record"], className: "bg-critical/40" },
        { value: Math.max(headcount - c.Absent - c["No record"], 0), className: "bg-transparent" },
      ],
      footer: { label: `${c.Absent} marked absent`, value: `${c["No record"]} not checked in` },
    },
    {
      key: "remote",
      label: "Remote",
      value: String(c.Remote),
      badge: { text: `${pct(c.Remote)}%`, tone: "neutral" },
      bar: [
        { value: c.Remote, className: "bg-indigo-400" },
        { value: Math.max(headcount - c.Remote, 0), className: "bg-transparent" },
      ],
      footer: { label: "Working from elsewhere", value: `${c.Remote} ${c.Remote === 1 ? "person" : "people"}` },
    },
  ];

  // ── Weekly trend: Mon–Fri of the selected date's week ──────────────
  const sel = parseDay(date);
  const monday = addDays(date, -((sel.getDay() + 6) % 7));
  const week = Array.from({ length: 5 }, (_, i) => {
    const day = addDays(monday, i);
    const rows = rowsFor(day);
    const t = tally(rows);
    const total = rows.length;
    const inCount = t.Present + t.Late + t.Remote;
    return { day, t, total, inCount, future: day > today, rate: total ? Math.round((inCount / total) * 1000) / 10 : 0 };
  });

  // ── Table: filter, search, page ────────────────────────────────────
  const departments = [...new Set(employees.map((e) => e.department).filter((d): d is string => !!d))].sort();
  const q = query.trim().toLowerCase();
  const filtered = dayRows
    .filter((r) => dept === "all" || r.emp.department === dept)
    .filter((r) => statusFilter === "All" || r.status === statusFilter)
    .filter((r) => !q || r.emp.name.toLowerCase().includes(q) || r.emp.email.toLowerCase().includes(q) || r.emp.role.toLowerCase().includes(q))
    // Checked-in people first (earliest first), then everyone else by name.
    .sort((a, b) => {
      const ai = a.rec?.clockIn ?? "~";
      const bi = b.rec?.clockIn ?? "~";
      return ai === bi ? a.emp.name.localeCompare(b.emp.name) : ai.localeCompare(bi);
    });
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * pageSize, current * pageSize + pageSize);

  function goTo(day: string) {
    setDate(day);
    setPage(0);
  }

  function handleDelete(row: AttendanceRow) {
    if (!window.confirm(`Delete ${row.employeeName}'s attendance for ${formatDay(row.date)}?`)) return;
    startTransition(async () => {
      try {
        await deleteAttendance(row.id);
        router.refresh(); // reload from the server so every number stays correct
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Could not delete the record.");
      }
    });
  }

  function exportCsv() {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [
      ["Date", "Employee", "Email", "Department", "Clock in", "Clock out", "Worked", "Status"],
      ...filtered.map((r) => [
        date,
        r.emp.name,
        r.emp.email,
        r.emp.department ?? "",
        formatTime(r.rec?.clockIn ?? null),
        formatTime(r.rec?.clockOut ?? null),
        formatDuration(minutesWorked(r.rec?.clockIn ?? null, r.rec?.clockOut ?? null)),
        r.status,
      ]),
    ];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const control =
    "h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-label-md text-ink outline-none transition-colors hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent";
  const longDate = parseDay(date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-label-sm uppercase tracking-wider text-ink-faint">
            <span>Operations</span>
            <span>/</span>
            <span className="normal-case tracking-normal text-ink-muted">Attendance</span>
            <Pill tone={date === today ? "accent" : "neutral"} dot={date === today}>
              {date === today ? "Today" : "Viewing"} · {formatDay(date)}
            </Pill>
          </div>
          <h1 className="text-headline-lg text-ink md:text-headline-xl">Attendance</h1>
          <p className="max-w-2xl text-body-md text-ink-muted">
            {isPending ? "Working…" : "Daily presence, punctuality and hours worked. Times shown in Lagos time (WAT)."}
          </p>
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-lg border border-border bg-surface-2 px-3 text-label-md text-ink transition-colors hover:border-border-strong hover:bg-white/[0.03] md:self-auto"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </section>

      {/* ── KPI cards ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.key} stat={s} />
        ))}
      </section>

      {/* ── Weekly trend ── */}
      <section className="rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-headline-md text-ink">
              <BarChart3 className="h-4 w-4 text-accent" /> Weekly Presence &amp; Punctuality
            </h2>
            <p className="text-body-sm text-ink-faint">Week of {formatDay(monday)} · click a day to view its log</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-label-sm text-ink-muted">
            {[
              ["On time", "bg-accent"],
              [`Late (>${LATE_AFTER_LABEL})`, "bg-warning"],
              ["Remote", "bg-indigo-400"],
              ["Absent / not in", "bg-critical"],
            ].map(([label, cls]) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${cls}`} />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-5 gap-3 rounded-lg border border-border bg-bg/50 p-4 sm:gap-6">
          {week.map((w) => {
            const selected = w.day === date;
            const isToday = w.day === today;
            const absent = w.t.Absent + w.t["No record"];
            return (
              <button
                key={w.day}
                onClick={() => goTo(w.day)}
                disabled={w.future}
                aria-pressed={selected}
                className="group flex flex-col items-center gap-2 disabled:cursor-default"
              >
                <span className={`tnum text-label-sm ${w.future ? "text-ink-faint/60" : selected ? "text-accent-hover" : "text-ink-faint"}`}>
                  {w.future ? "Upcoming" : `${w.rate}%`}
                </span>
                {/* Stacked bar: segment heights are proportional to each count */}
                <div
                  className={[
                    "flex h-36 w-full max-w-16 flex-col-reverse overflow-hidden rounded-md transition-all",
                    w.future ? "border border-dashed border-border-strong bg-surface/40" : "bg-surface-2",
                    selected ? "ring-2 ring-accent/60 ring-offset-2 ring-offset-bg" : "group-hover:ring-1 group-hover:ring-border-strong",
                  ].join(" ")}
                >
                  {!w.future && w.total > 0 && (
                    <>
                      <span className="bg-accent" style={{ flexGrow: w.t.Present }} />
                      <span className="bg-warning" style={{ flexGrow: w.t.Late }} />
                      <span className="bg-indigo-400" style={{ flexGrow: w.t.Remote }} />
                      <span className="bg-critical/70" style={{ flexGrow: absent }} />
                    </>
                  )}
                </div>
                <span className={`text-label-md ${selected ? "text-accent-hover" : w.future ? "text-ink-faint/60" : "text-ink"}`}>
                  {parseDay(w.day).toLocaleDateString("en-US", { weekday: "short" })} {parseDay(w.day).getDate()}
                </span>
                <span className="tnum -mt-1.5 text-body-sm text-ink-faint">
                  {w.future ? "—" : isToday ? `${w.inCount} live` : `${w.inCount} in`}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Toolbar ── */}
      <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-2 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2">
          <div className="flex h-9 items-center rounded-lg border border-border bg-surface-2">
            <button onClick={() => goTo(addDays(date, -1))} aria-label="Previous day" className="grid h-9 w-8 place-items-center text-ink-muted hover:text-ink">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <label className="relative flex cursor-pointer items-center gap-2 px-1 text-label-md text-ink">
              <CalendarDays className="h-4 w-4 text-accent" />
              <span className="whitespace-nowrap">{longDate}</span>
              {/* the real date picker sits invisibly on top of the label */}
              <input
                type="date"
                value={date}
                max={today}
                onChange={(e) => e.target.value && goTo(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="Pick a date"
              />
            </label>
            <button
              onClick={() => goTo(addDays(date, 1))}
              disabled={date >= today}
              aria-label="Next day"
              className="grid h-9 w-8 place-items-center text-ink-muted hover:text-ink disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <button onClick={() => goTo(today)} className="h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-label-sm text-ink-muted transition-colors hover:border-border-strong hover:text-ink">
            Today
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <select aria-label="Department" value={dept} onChange={(e) => { setDept(e.target.value); setPage(0); }} className={control}>
            <option value="all">All departments ({headcount})</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select aria-label="Status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} className={control}>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All statuses" : s === "Present" ? "On time" : s === "No record" ? "Not checked in" : s}
              </option>
            ))}
          </select>
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(0); }}
              placeholder="Search employee, email, role…"
              className="h-9 w-full rounded-lg border border-border bg-surface-2 pl-8 pr-3 text-body-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>
      </section>

      {/* ── Daily log ── */}
      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <h2 className="text-headline-md text-ink">Daily Log</h2>
          <span className="tnum text-body-sm text-ink-faint">{filtered.length} people</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] leading-[18px]">
            <thead>
              <tr className="border-b border-border text-label-sm uppercase tracking-[0.05em] text-ink-faint">
                <th className="px-5 py-3 font-medium">Employee</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Department</th>
                <th className="px-4 py-3 font-medium">Check-in</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Check-out</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Worked</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ emp, rec, status }) => {
                const worked = minutesWorked(rec?.clockIn ?? null, rec?.clockOut ?? null);
                const stillIn = !!rec?.clockIn && !rec.clockOut;
                const late = status === "Late" && rec?.clockIn ? minutesLate(rec.clockIn) : 0;
                return (
                  <tr key={emp.id} className="h-14 border-b border-border last:border-0 hover:bg-surface-2">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="relative shrink-0">
                          <div className="grid h-8 w-8 place-items-center rounded-full bg-surface-2 text-[10px] font-semibold text-ink-muted">
                            {initialsOf(emp.name)}
                          </div>
                          <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${attendanceDot(status)}`} />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{emp.name}</p>
                          <p className="truncate text-body-sm text-ink-faint">
                            {emp.role} · {emp.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-2.5 text-ink-muted lg:table-cell">{emp.department ?? "—"}</td>
                    <td className="tnum px-4 py-2.5">
                      {rec?.clockIn ? (
                        <span className={status === "Late" ? "text-warning" : "text-ink"}>{formatTime(rec.clockIn)}</span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="tnum hidden px-4 py-2.5 sm:table-cell">
                      {rec?.clockOut ? (
                        <span className="text-ink">{formatTime(rec.clockOut)}</span>
                      ) : stillIn ? (
                        date === today ? (
                          <span className="text-accent-hover">Still in</span>
                        ) : (
                          <span className="text-warning">Didn&apos;t clock out</span>
                        )
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-2.5 md:table-cell">
                      <div className="flex items-center gap-2">
                        <span className="tnum w-14 text-ink">{worked !== null ? formatDuration(worked) : stillIn ? "In progress" : "—"}</span>
                        {worked !== null && (
                          <span className="h-1 w-14 overflow-hidden rounded-full bg-bg">
                            <span
                              className={`block h-full rounded-full ${status === "Late" ? "bg-warning" : status === "Remote" ? "bg-indigo-400" : "bg-accent"}`}
                              style={{ width: `${Math.min(100, (worked / FULL_DAY) * 100)}%` }}
                            />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <AttendanceStatusBadge status={status} note={late ? `+${late}m` : undefined} />
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex justify-end">
                        {rec && (
                          <button
                            onClick={() => handleDelete(rec)}
                            disabled={isPending}
                            aria-label={`Delete ${emp.name}'s record`}
                            className="grid h-7 w-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-critical/10 hover:text-critical disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {visible.length === 0 && (
            <div className="grid place-items-center py-16 text-center">
              <div>
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface-2">
                  <Clock className="h-5 w-5 text-ink-faint" />
                </div>
                <p className="mt-3 text-headline-sm text-ink">Nobody matches</p>
                <p className="mt-1 text-body-md text-ink-muted">Try another filter or date.</p>
              </div>
            </div>
          )}
        </div>

        {/* Pagination */}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-5 py-3 text-body-sm text-ink-faint sm:flex-row">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              Rows per page
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                className="h-7 rounded-md border border-border bg-surface-2 px-1.5 text-label-sm text-ink outline-none"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <span className="tnum">
              {filtered.length ? `${current * pageSize + 1}–${current * pageSize + visible.length}` : 0} of {filtered.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
              className="rounded-md border border-border px-2.5 py-1 text-label-sm text-ink-muted transition-colors hover:border-border-strong hover:text-ink disabled:opacity-40"
            >
              Previous
            </button>
            <span className="tnum text-label-sm text-ink">
              Page {current + 1} of {pages}
            </span>
            <button
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
              className="rounded-md border border-border px-2.5 py-1 text-label-sm text-ink-muted transition-colors hover:border-border-strong hover:text-ink disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
