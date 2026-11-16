"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Trash2,
  Clock,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Search,
  Download,
  Users,
  AlertTriangle,
  AlarmClock,
  Timer,
} from "lucide-react";
import { initialsOf } from "@/lib/sample-data";
import { deptTint } from "@/lib/dept-tint";
import {
  formatTime,
  formatDuration,
  formatDay,
  minutesWorked,
  minutesLate,
  minutesOfDay,
  LATE_AFTER_LABEL,
  LATE_AFTER_MINUTES,
  type AttendanceRow,
} from "@/lib/attendance";
import { deleteAttendance } from "@/lib/attendance-actions";
import AttendanceStatusBadge, { attendanceDot, attendanceLabel } from "./AttendanceStatusBadge";

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
const CAPS = "text-[11px] font-bold uppercase tracking-[0.06em]";

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

// "08:52" (24-hour, Lagos time) — compact enough for the heatmap cells.
const hhmm = (iso: string) => {
  const m = minutesOfDay(iso);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
// 534 (minutes after midnight) → "8:54 AM".
const minutesLabel = (m: number) => {
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

const tally = (rows: DayRow[]) => {
  const c: Record<string, number> = { Present: 0, Late: 0, Remote: 0, Absent: 0, "No record": 0 };
  for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
  return c;
};

// ── Small page-local pieces ──────────────────────────────────────────

// Round initials avatar, tinted by the person's department.
function Avatar({ name, department, size = "h-9 w-9", ring = "" }: { name: string; department: string | null; size?: string; ring?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center rounded-full ${size} ${deptTint(department)} ${ring} text-[10px] font-semibold text-ink`} title={name}>
      {initialsOf(name)}
    </span>
  );
}

// A row of overlapping avatars on the navy band, with "+N" for the rest.
function NavyFaces({ rows }: { rows: DayRow[] }) {
  const shown = rows.slice(0, 4);
  const extra = rows.length - shown.length;
  if (rows.length === 0) return <p className="my-2 text-body-sm text-on-navy-muted">Nobody</p>;
  return (
    <div className="my-2 flex items-center -space-x-2">
      {shown.map((r) => (
        <Avatar key={r.emp.id} name={r.emp.name} department={r.emp.department} size="h-8 w-8" ring="border-2 border-navy-2" />
      ))}
      {extra > 0 && (
        <span className="tnum grid h-8 min-w-8 place-items-center rounded-full border-2 border-navy-2 bg-navy-line px-1 text-[11px] font-bold text-on-navy-muted">
          +{extra}
        </span>
      )}
    </div>
  );
}

// One breakdown tile inside the navy band.
function SnapCard({
  label,
  tag,
  highlight,
  onClick,
  children,
  footer,
}: {
  label: string;
  tag?: string;
  highlight?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  const cls = `flex flex-col justify-between rounded-lg border p-4 text-left ${
    highlight ? "border-accent bg-navy-2" : "border-navy-line bg-navy-2"
  } ${onClick ? "transition-colors hover:border-on-navy-muted" : ""}`;
  const body = (
    <>
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className={`${CAPS} ${highlight ? "text-[#f5c518]" : "text-on-navy-muted"}`}>{label}</span>
          {tag && (
            <span
              className={`rounded px-2 py-0.5 text-[11px] font-semibold ${highlight ? "bg-accent text-on-accent" : "bg-navy-line text-on-navy-muted"}`}
            >
              {tag}
            </span>
          )}
        </div>
        {children}
      </div>
      <div className="mt-2 text-[12px] text-on-navy-muted">{footer}</div>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// One cell in the weekly heatmap: the clock-in time, coloured by status.
function HeatCell({ row, selected, future }: { row: DayRow | null; selected: boolean; future: boolean }) {
  const base = `tnum flex h-9 w-full items-center justify-center rounded-md px-1 text-[12px] ${selected ? "font-semibold" : ""}`;
  if (future) return <span className={`${base} border border-dashed border-border`} />;
  if (!row) return <span className={`${base} text-ink-faint`} title="Not yet employed" />; // before their start date
  const { rec, status } = row;
  if (status === "Late" && rec?.clockIn)
    return (
      <span className={`${base} bg-accent-soft text-accent-ink ${selected ? "ring-1 ring-accent" : ""}`}>
        {hhmm(rec.clockIn)}
        {selected && <span className="ml-1 opacity-80">+{minutesLate(rec.clockIn)}m</span>}
      </span>
    );
  if (status === "Present" && rec?.clockIn) return <span className={`${base} bg-tint-sky text-ink`}>{hhmm(rec.clockIn)}</span>;
  if (status === "Remote") return <span className={`${base} bg-tint-lilac text-ink`}>Remote</span>;
  if (status === "Absent") return <span className={`${base} bg-tint-rose text-critical`}>Absent</span>;
  return <span className={`${base} bg-surface-2 text-ink-faint`}>—</span>;
}

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
  const inDept = (e: AttendanceEmployee) => dept === "all" || e.department === dept;
  const rowFor = (emp: AttendanceEmployee, day: string): DayRow | null => {
    if (emp.startedAt > day) return null; // hadn't started yet
    const rec = byKey.get(`${emp.id}|${day}`) ?? null;
    return { emp, rec, status: rec?.status ?? "No record" };
  };

  // Everyone employed on a given day (in the chosen department), with their record (or none).
  function rowsFor(day: string): DayRow[] {
    return employees
      .filter(inDept)
      .map((e) => rowFor(e, day))
      .filter((r): r is DayRow => r !== null);
  }

  // ── The selected day ──────────────────────────────────────────────
  const dayRows = rowsFor(date);
  const c = tally(dayRows);
  const headcount = dayRows.length;
  const pctOf = (n: number) => (headcount ? Math.round((n / headcount) * 100) : 0);
  const inOffice = dayRows.filter((r) => r.status === "Present" || r.status === "Late");
  const remote = dayRows.filter((r) => r.status === "Remote");
  const lateRows = dayRows
    .filter((r) => r.status === "Late" && r.rec?.clockIn)
    .sort((a, b) => minutesLate(b.rec!.clockIn!) - minutesLate(a.rec!.clockIn!));
  const lateDelays = lateRows.map((r) => minutesLate(r.rec!.clockIn!));
  const avgDelay = lateDelays.length ? Math.round(lateDelays.reduce((s, n) => s + n, 0) / lateDelays.length) : 0;
  const notIn = c.Absent + c["No record"];

  // Arrival times (minutes after midnight) of everyone who came in.
  const arrivals = inOffice.map((r) => minutesOfDay(r.rec!.clockIn!));
  const earliest = arrivals.length ? Math.min(...arrivals) : null;
  const avgArrival = arrivals.length ? Math.round(arrivals.reduce((s, n) => s + n, 0) / arrivals.length) : null;

  // ── The week (Mon–Fri) around the selected date ───────────────────
  const sel = parseDay(date);
  const monday = addDays(date, -((sel.getDay() + 6) % 7));
  const week = Array.from({ length: 5 }, (_, i) => {
    const day = addDays(monday, i);
    const t = tally(rowsFor(day));
    const checkedIn = t.Present + t.Late;
    return {
      day,
      future: day > today,
      onTime: t.Present,
      checkedIn,
      // On-time rate = people on time ÷ people who checked in at the office.
      rate: checkedIn ? Math.round((t.Present / checkedIn) * 1000) / 10 : null,
    };
  });
  const pastWeek = week.filter((w) => !w.future);
  const weekIn = pastWeek.reduce((s, w) => s + w.checkedIn, 0);
  const weekRate = weekIn ? Math.round((pastWeek.reduce((s, w) => s + w.onTime, 0) / weekIn) * 1000) / 10 : null;
  const weekdayShort = (day: string) => parseDay(day).toLocaleDateString("en-US", { weekday: "short" });

  // ── Table: filter, search, page ────────────────────────────────────
  const departments = [...new Set(employees.map((e) => e.department).filter((d): d is string => !!d))].sort();
  const q = query.trim().toLowerCase();
  const filtered = dayRows
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
  function showStatus(s: string) {
    setStatusFilter(s);
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

  const isToday = date === today;
  const longDate = parseDay(date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" });
  const pill = "h-10 rounded-full border border-border bg-surface px-4 text-label-md text-ink outline-none transition-colors hover:bg-bg focus:border-ink focus:ring-1 focus:ring-ink";

  return (
    <div className="space-y-6">
      {/* ── Editorial header ── */}
      <header className="flex flex-col justify-between gap-5 border-b border-border pb-6 xl:flex-row xl:items-end">
        <div className="min-w-0">
          <div className={`mb-1.5 flex flex-wrap items-center gap-1.5 ${CAPS} text-ink-muted`}>
            <span>Operations</span>
            <span className="text-ink-faint">•</span>
            <span className="text-ink">Daily attendance &amp; roster</span>
          </div>
          <h1 className="text-headline-lg text-ink md:text-headline-xl">{isToday ? "Who’s in today." : `Who was in, ${formatDay(date)}.`}</h1>
          <p className="mt-1 max-w-2xl text-body-md text-ink-muted">
            {isPending
              ? "Working…"
              : `${inOffice.length + remote.length} of ${headcount} ${headcount === 1 ? "person" : "people"} checked in. Late after ${LATE_AFTER_LABEL} · times in Lagos time (WAT).`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Date navigator */}
          <div className="flex h-10 items-center rounded-full border border-border bg-surface p-1">
            <button onClick={() => goTo(addDays(date, -1))} aria-label="Previous day" className="grid h-8 w-8 place-items-center rounded-full text-ink hover:bg-surface-2">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <label className="relative flex cursor-pointer items-center gap-2 px-2 text-label-md font-semibold text-ink">
              <CalendarDays className="h-4 w-4 text-ink-muted" />
              {/* full date on wider screens, short one on phones */}
              <span className="hidden whitespace-nowrap sm:inline">{longDate}</span>
              <span className="whitespace-nowrap sm:hidden">{formatDay(date)}</span>
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
              className="grid h-8 w-8 place-items-center rounded-full text-ink hover:bg-surface-2 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={() => goTo(today)}
              disabled={isToday}
              className={`ml-1 h-8 rounded-full px-3 ${CAPS} transition-colors ${isToday ? "bg-navy text-on-navy" : "bg-surface-2 text-ink hover:bg-navy hover:text-on-navy"}`}
            >
              Today
            </button>
          </div>

          {/* Department ("squad") filter */}
          <div className="relative">
            <Users className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <select
              aria-label="Department"
              value={dept}
              onChange={(e) => {
                setDept(e.target.value);
                setPage(0);
              }}
              className={`${pill} pl-9`}
            >
              <option value="all">All departments ({departments.length})</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <button onClick={exportCsv} className={`${pill} inline-flex items-center gap-2`}>
            <Download className="h-4 w-4" />
            Export report
          </button>
        </div>
      </header>

      {/* ── Navy "right now" band ── */}
      <section className="flex flex-col gap-5 rounded-xl bg-navy p-5 text-on-navy md:p-6">
        <div className="flex flex-col justify-between gap-2 border-b border-navy-line pb-4 lg:flex-row lg:items-center">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              {isToday && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />}
              <span className="relative inline-flex h-3 w-3 rounded-full bg-accent" />
            </span>
            <span className={`${CAPS} text-on-navy-muted`}>
              {isToday ? "Live snapshot" : "Snapshot"} · {longDate}
            </span>
          </div>
          <span className="text-body-sm text-on-navy-muted">
            {headcount} {headcount === 1 ? "person" : "people"} on the roster{dept !== "all" ? ` in ${dept}` : ""}
          </span>
        </div>

        {/* Big headline numbers */}
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
          <p className="flex items-baseline gap-2">
            <span className="tnum font-display text-[44px] font-bold leading-none">{inOffice.length}</span>
            <span className="text-headline-sm text-on-navy-muted">in office</span>
          </p>
          <p className="flex items-baseline gap-2">
            <span className="tnum font-display text-[44px] font-bold leading-none">{remote.length}</span>
            <span className="text-headline-sm text-on-navy-muted">remote</span>
          </p>
          <button
            type="button"
            onClick={() => showStatus("Late")}
            className="flex items-baseline gap-2 rounded-md border border-accent/40 bg-accent/15 px-3 py-1 text-[#f5c518]"
          >
            <span className="tnum font-display text-[44px] font-bold leading-none">{c.Late}</span>
            <span className="text-headline-sm font-bold">late</span>
            {c.Late > 0 && <span className={`ml-1 rounded bg-accent px-2 py-0.5 ${CAPS} text-on-accent`}>Needs review</span>}
          </button>
          <p className="flex items-baseline gap-2">
            <span className="tnum font-display text-[44px] font-bold leading-none text-on-navy-muted">{notIn}</span>
            <span className="text-headline-sm text-on-navy-muted">not in</span>
          </p>
        </div>

        {/* Breakdown tiles */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SnapCard
            label={`In office (${inOffice.length})`}
            tag={`${pctOf(inOffice.length)}% of staff`}
            footer={earliest !== null ? `Earliest check-in: ${minutesLabel(earliest)}` : "No check-ins yet"}
          >
            <NavyFaces rows={inOffice} />
          </SnapCard>
          <SnapCard label={`Remote (${remote.length})`} tag={`${pctOf(remote.length)}%`} footer="Working from elsewhere">
            <NavyFaces rows={remote} />
          </SnapCard>
          <SnapCard
            label={`Late flagged (${c.Late})`}
            tag={c.Late > 0 ? "Review" : undefined}
            highlight={c.Late > 0}
            onClick={() => showStatus("Late")}
            footer={
              c.Late > 0 ? (
                <span className="flex items-center gap-1.5 text-[#f5c518]">
                  <AlertTriangle className="h-3.5 w-3.5" /> Average delay {avgDelay} min
                </span>
              ) : (
                `Everyone in by ${LATE_AFTER_LABEL}`
              )
            }
          >
            {lateRows.length > 0 ? (
              <div className="my-2 flex items-center gap-2">
                <div className="flex -space-x-2">
                  {lateRows.slice(0, 2).map((r) => (
                    <Avatar key={r.emp.id} name={r.emp.name} department={r.emp.department} size="h-8 w-8" ring="border-2 border-navy-2" />
                  ))}
                </div>
                <div className="min-w-0 text-body-sm">
                  {lateRows.slice(0, 2).map((r, i) => (
                    <p key={r.emp.id} className={`truncate ${i === 0 ? "font-semibold text-on-navy" : "text-on-navy-muted"}`}>
                      {r.emp.name.split(" ")[0]} (+{minutesLate(r.rec!.clockIn!)}m)
                    </p>
                  ))}
                </div>
              </div>
            ) : (
              <p className="my-2 text-body-sm text-on-navy-muted">Nobody</p>
            )}
          </SnapCard>
          <SnapCard label={`Not in (${notIn})`} tag={c.Absent > 0 ? `${c.Absent} absent` : undefined} footer={`${c.Absent} marked absent · ${c["No record"]} not checked in`}>
            <NavyFaces rows={dayRows.filter((r) => r.status === "Absent" || r.status === "No record")} />
          </SnapCard>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
        {/* ── Weekly heatmap / daily log ── */}
        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface xl:col-span-2">
          <div className="flex flex-col justify-between gap-3 border-b border-border px-5 py-4 lg:flex-row lg:items-start">
            <div>
              <h2 className="text-headline-md text-ink">Weekly attendance heatmap</h2>
              <p className="text-body-sm text-ink-muted">
                Week of {formatDay(monday)} · check-in times, highlighted column is the selected day
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[
                ["On time", "bg-tint-sky"],
                ["Late", "bg-accent-soft"],
                ["Remote", "bg-tint-lilac"],
                ["Absent", "bg-tint-rose"],
              ].map(([label, cls]) => (
                <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-label-sm text-ink">
                  <span className={`h-2.5 w-2.5 rounded-sm ${cls}`} />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Status chips + search */}
          <div className="flex flex-col gap-2 border-b border-border px-5 py-3 lg:flex-row lg:items-center">
            <div className="flex flex-1 flex-wrap gap-1.5">
              {STATUS_FILTERS.map((s) => {
                const active = statusFilter === s;
                const count = s === "All" ? headcount : c[s] ?? 0;
                return (
                  <button
                    key={s}
                    onClick={() => showStatus(s)}
                    aria-pressed={active}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-label-sm transition-colors ${
                      active ? "bg-navy text-on-navy" : "border border-border bg-surface text-ink hover:bg-bg"
                    }`}
                  >
                    {s !== "All" && <span className={`h-1.5 w-1.5 rounded-full ${attendanceDot(s)}`} />}
                    {s === "All" ? "All" : attendanceLabel(s)}
                    <span className={`tnum ${active ? "text-on-navy-muted" : "text-ink-muted"}`}>{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="relative lg:w-60">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder="Search name, email, role…"
                aria-label="Search employees"
                className="h-9 w-full rounded-full border border-border bg-bg pl-9 pr-3 text-body-sm text-ink outline-none transition-colors placeholder:text-ink-faint focus:border-ink focus:ring-1 focus:ring-ink"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-[13px] leading-[18px]">
              <thead>
                <tr className={`border-b border-border bg-bg ${CAPS} text-ink-muted`}>
                  <th className="px-5 py-3">Team member</th>
                  {week.map((w) => (
                    <th
                      key={w.day}
                      className={`w-20 px-1.5 py-3 text-center ${w.day === date ? "bg-surface-2 text-ink" : ""}`}
                    >
                      <button
                        onClick={() => goTo(w.day)}
                        disabled={w.future}
                        className="inline-flex items-center gap-1 uppercase hover:text-ink disabled:cursor-default disabled:opacity-60"
                      >
                        {weekdayShort(w.day)} {parseDay(w.day).getDate()}
                        {w.day === today && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                      </button>
                    </th>
                  ))}
                  <th className="px-4 py-3">Selected day</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ emp, rec, status }) => {
                  const worked = minutesWorked(rec?.clockIn ?? null, rec?.clockOut ?? null);
                  const stillIn = !!rec?.clockIn && !rec.clockOut;
                  const late = status === "Late" && rec?.clockIn ? minutesLate(rec.clockIn) : 0;
                  return (
                    <tr key={emp.id} className={`border-b border-border last:border-0 hover:bg-bg ${status === "Late" ? "bg-accent-soft/40" : ""}`}>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar name={emp.name} department={emp.department} />
                            <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${attendanceDot(status)}`} />
                          </div>
                          <div className="min-w-0 max-w-52">
                            <p className="truncate font-semibold text-ink">{emp.name}</p>
                            <p className="truncate text-body-sm text-ink-muted" title={emp.email}>
                              {emp.department ?? emp.role}
                            </p>
                          </div>
                        </div>
                      </td>
                      {week.map((w) => (
                        <td key={w.day} className={`px-1.5 py-2.5 ${w.day === date ? "bg-surface-2" : ""}`}>
                          <HeatCell row={rowFor(emp, w.day)} selected={w.day === date} future={w.future} />
                        </td>
                      ))}
                      <td className="px-4 py-2.5">
                        <AttendanceStatusBadge status={status} note={late ? `+${late}m` : undefined} />
                        <p className="tnum mt-1 whitespace-nowrap text-body-sm text-ink-muted">
                          {rec?.clockIn ? `${formatTime(rec.clockIn)} → ` : ""}
                          {rec?.clockOut ? (
                            `${formatTime(rec.clockOut)} · ${formatDuration(worked)}`
                          ) : stillIn ? (
                            isToday ? (
                              <span className="text-good">Still in</span>
                            ) : (
                              <span className="text-warning">Didn&apos;t clock out</span>
                            )
                          ) : rec?.clockIn ? (
                            "—"
                          ) : null}
                        </p>
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex justify-end">
                          {rec && (
                            <button
                              onClick={() => handleDelete(rec)}
                              disabled={isPending}
                              aria-label={`Delete ${emp.name}'s record`}
                              className="grid h-8 w-8 place-items-center rounded-full text-ink-muted transition-colors hover:bg-critical/10 hover:text-critical disabled:opacity-50"
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
                  <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-surface-2">
                    <Clock className="h-5 w-5 text-ink-faint" />
                  </div>
                  <p className="mt-3 text-headline-sm text-ink">Nobody matches</p>
                  <p className="mt-1 text-body-md text-ink-muted">Try another filter or date.</p>
                </div>
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-5 py-3 text-body-sm text-ink-muted sm:flex-row">
            <div className="flex items-center gap-3">
              <span className="tnum">
                Showing <strong className="text-ink">{visible.length}</strong> of <strong className="text-ink">{filtered.length}</strong>
              </span>
              <label className="flex items-center gap-2">
                Rows
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(0);
                  }}
                  className="h-8 rounded-full border border-border bg-surface px-2 text-label-sm text-ink outline-none"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={current === 0}
                onClick={() => setPage(current - 1)}
                className="h-8 rounded-full border border-border px-4 text-label-md text-ink transition-colors hover:bg-bg disabled:opacity-40"
              >
                Previous
              </button>
              <span className="tnum text-label-md text-ink">
                {current + 1} / {pages}
              </span>
              <button
                disabled={current >= pages - 1}
                onClick={() => setPage(current + 1)}
                className="h-8 rounded-full border border-border px-4 text-label-md text-ink transition-colors hover:bg-bg disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </section>

        {/* ── Right rail ── */}
        <div className="space-y-6">
          {/* Running late */}
          <section className="rounded-xl border border-border bg-surface">
            <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
              <h2 className="flex items-center gap-2 text-headline-md text-ink">
                <AlarmClock className="h-5 w-5" /> {isToday ? "Running late today" : "Late arrivals"}
              </h2>
              <span className="tnum rounded-full bg-accent-soft px-2.5 py-0.5 text-label-sm font-semibold text-accent-ink">
                {c.Late} {c.Late === 1 ? "teammate" : "teammates"}
              </span>
            </div>
            {lateRows.length === 0 ? (
              <p className="px-5 py-8 text-center text-body-md text-ink-muted">Everyone who came in was on time.</p>
            ) : (
              <ul className="divide-y divide-border">
                {lateRows.slice(0, 5).map((r) => (
                  <li key={r.emp.id} className="flex items-start gap-3 px-5 py-4">
                    <Avatar name={r.emp.name} department={r.emp.department} size="h-10 w-10" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{r.emp.name}</p>
                      <p className="truncate text-body-sm text-ink-muted">{r.emp.role}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="tnum rounded-md bg-accent-soft px-2 py-0.5 text-label-sm font-semibold text-accent-ink">
                        +{minutesLate(r.rec!.clockIn!)}m late
                      </span>
                      <p className="tnum mt-1 text-body-sm text-ink-muted">
                        Due {LATE_AFTER_LABEL} · In {formatTime(r.rec!.clockIn)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {lateRows.length > 5 && (
              <button
                onClick={() => showStatus("Late")}
                className="w-full border-t border-border px-5 py-3 text-label-md text-ink transition-colors hover:bg-bg"
              >
                Show all {lateRows.length} in the table
              </button>
            )}
          </section>

          {/* Weekly punctuality */}
          <section className="rounded-xl border border-border bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-headline-md text-ink">Weekly punctuality</h2>
                <p className="text-body-sm text-ink-muted">On-time check-in rate (cut-off {LATE_AFTER_LABEL})</p>
              </div>
              <div className="text-right">
                <p className="tnum font-display text-metric-md text-ink">{weekRate !== null ? `${weekRate}%` : "—"}</p>
                <p className={`${CAPS} text-ink-muted`}>Week avg</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-5 gap-2 rounded-lg border border-border bg-bg p-3">
              {week.map((w) => {
                const selected = w.day === date;
                return (
                  <button
                    key={w.day}
                    onClick={() => goTo(w.day)}
                    disabled={w.future}
                    aria-pressed={selected}
                    className={`flex flex-col items-center gap-1.5 rounded-md py-2 transition-colors disabled:cursor-default ${selected ? "bg-accent-soft" : "hover:bg-surface"}`}
                  >
                    <span className="tnum text-label-sm font-semibold text-ink">{w.future || w.rate === null ? "—" : `${w.rate}%`}</span>
                    <span className="flex h-28 w-6 items-end">
                      {w.future ? (
                        <span className="block h-full w-full rounded-sm border border-dashed border-border-strong" />
                      ) : (
                        <span
                          className={`block w-full rounded-sm ${selected ? "bg-navy" : "bg-chart-3"}`}
                          style={{ height: `${Math.max(w.rate ?? 0, 2)}%` }}
                        />
                      )}
                    </span>
                    <span className="text-label-sm text-ink-muted">{w.day === today ? "Today" : weekdayShort(w.day)}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-4 flex items-center gap-3 text-body-sm">
              <Timer className="h-4 w-4 shrink-0 text-ink-muted" />
              <span className="text-ink-muted">Avg arrival</span>
              <span className="tnum font-semibold text-ink">{avgArrival !== null ? minutesLabel(avgArrival) : "—"}</span>
              {avgArrival !== null && (
                <span
                  className={`tnum ml-auto rounded-md px-2 py-1 text-label-sm ${
                    avgArrival <= LATE_AFTER_MINUTES ? "bg-tint-sky text-ink" : "bg-accent-soft text-accent-ink"
                  }`}
                >
                  {avgArrival <= LATE_AFTER_MINUTES
                    ? `${LATE_AFTER_MINUTES - avgArrival}m before cut-off`
                    : `${avgArrival - LATE_AFTER_MINUTES}m after cut-off`}
                </span>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
