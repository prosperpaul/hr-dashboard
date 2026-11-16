import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageLeave } from "@/lib/permissions";
import { initialsOf } from "@/lib/sample-data";
import { todayISO, minutesOfDay, APP_TIME_ZONE } from "@/lib/attendance";
import HeroBand, { type HeadcountPoint } from "@/components/dashboard/HeroBand";
import ApprovalQueue, { type PendingLeave } from "@/components/dashboard/ApprovalQueue";
import {
  Caps,
  OutThisWeek,
  Celebrations,
  NewFaces,
  AcrossCompany,
  type OutRow,
  type Celebration,
  type Face,
  type DeptShare,
} from "@/components/dashboard/OverviewParts";

const DAY = 86_400_000;

// Local YYYY-MM-DD for a date.
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Parse "YYYY-MM-DD" as a LOCAL date (plain `new Date("2026-11-14")` would be UTC).
function parseDay(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

const short = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric" });

// "Nov 18", "Nov 18–22", or "Nov 28 – Dec 2".
function dateRange(startISO: string, endISO: string): string {
  const a = parseDay(startISO);
  const b = parseDay(endISO);
  if (startISO === endISO) return short(a);
  if (a.getMonth() === b.getMonth()) return `${short(a)}–${b.getDate()}`;
  return `${short(a)} – ${short(b)}`;
}

// "today" / "3 days ago" / "2 weeks ago" / "4 months ago" / "2 years ago".
function relativeDay(dateISO: string, today: Date): string {
  const days = Math.floor((today.getTime() - parseDay(dateISO).getTime()) / DAY);
  if (isNaN(days)) return dateISO;
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"} ago`;
  if (days <= 0) return "today";
  if (days < 7) return unit(days, "day");
  if (days < 35) return unit(Math.floor(days / 7), "week");
  if (days < 365) return unit(Math.floor(days / 30), "month");
  return unit(Math.floor(days / 365), "year");
}

// ISO week number (weeks start Monday; week 1 contains Jan 4th).
function isoWeek(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / DAY + 1) / 7);
}

// ["a", "b", "c"] → "a, b and c"
function joinWords(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

const NUMBER_WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const countWord = (n: number) => NUMBER_WORDS[n] ?? String(n);

export default async function OverviewPage() {
  const session = await auth();
  const canApprove = canManageLeave(session?.user?.role);

  // "Today" in the business time zone (Lagos), not the server's UTC clock.
  const now = new Date();
  const todayStr = todayISO();
  const today = parseDay(todayStr); // midnight of that calendar day
  const cutoff30 = ymd(new Date(today.getTime() - 30 * DAY));
  const weekEnd = ymd(new Date(today.getTime() + 6 * DAY));

  // Everything the page needs, fetched in ONE parallel round of queries.
  const [employees, deptRecords, onLeaveToday, outThisWeek, openRoles, pipeline, finalStage, pending, pendingCount] =
    await Promise.all([
      prisma.employee.findMany({
        select: { id: true, name: true, role: true, status: true, startedAt: true, department: { select: { name: true } } },
      }),
      prisma.department.findMany({ include: { _count: { select: { employees: true } } } }),
      // Who is off today (approved leave whose date range covers today).
      prisma.leaveRequest.findMany({
        where: { status: "Approved", startDate: { lte: todayStr }, endDate: { gte: todayStr } },
        select: { employee: { select: { departmentId: true } } },
      }),
      // Anyone off at some point in the next 7 days.
      prisma.leaveRequest.findMany({
        where: { status: "Approved", startDate: { lte: weekEnd }, endDate: { gte: todayStr } },
        orderBy: { startDate: "asc" },
        take: 5,
        select: {
          id: true,
          type: true,
          startDate: true,
          endDate: true,
          employee: { select: { name: true, department: { select: { name: true } } } },
        },
      }),
      prisma.job.count({ where: { status: "Open" } }),
      // Candidates still in play for open jobs.
      prisma.candidate.count({ where: { job: { status: "Open" }, stage: { notIn: ["Hired", "Rejected"] } } }),
      prisma.candidate.count({ where: { job: { status: "Open" }, stage: { in: ["Interview", "Offer"] } } }),
      // The approval queue — only fetched for people who can approve.
      canApprove
        ? prisma.leaveRequest.findMany({
            where: { status: "Pending" },
            orderBy: { startDate: "asc" },
            take: 3,
            select: {
              id: true,
              type: true,
              days: true,
              startDate: true,
              endDate: true,
              employee: { select: { name: true, department: { select: { name: true } } } },
            },
          })
        : Promise.resolve([]),
      canApprove ? prisma.leaveRequest.count({ where: { status: "Pending" } }) : Promise.resolve(0),
    ]);

  const totalEmployees = employees.length;

  // ── Headcount history: last 12 months ──────────────────────────────
  // For each month: everyone who had started by month end (cumulative),
  // and how many started DURING that month.
  const history: HeadcountPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const first = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const monthStart = ymd(first);
    const monthEnd = ymd(new Date(first.getFullYear(), first.getMonth() + 1, 0));
    history.push({
      month: first.toLocaleString("en-US", { month: "short" }),
      label: first.toLocaleString("en-US", { month: "short", year: "numeric" }),
      headcount: employees.filter((e) => e.startedAt <= monthEnd).length,
      hires: employees.filter((e) => e.startedAt >= monthStart && e.startedAt <= monthEnd).length,
    });
  }

  // ── Ledger strip figures ────────────────────────────────────────────
  const newHires30 = employees.filter((e) => e.startedAt >= cutoff30).length;
  const leaveTeams = new Set(onLeaveToday.map((l) => l.employee.departmentId ?? "none")).size;
  // Average time since each person's start date, in years (1 decimal).
  const avgTenure = totalEmployees
    ? Math.round(
        (employees.reduce((sum, e) => sum + Math.max(0, today.getTime() - parseDay(e.startedAt).getTime()), 0) /
          totalEmployees /
          (365.25 * DAY)) *
          10,
      ) / 10
    : 0;

  const ledger = [
    { label: "New hires", value: newHires30, note: "past 30d" },
    {
      label: "On leave today",
      value: onLeaveToday.length,
      note: onLeaveToday.length ? `across ${leaveTeams} ${leaveTeams === 1 ? "team" : "teams"}` : "everyone in",
    },
    { label: "Open roles", value: openRoles, note: `${finalStage} in final stage` },
    { label: "Avg. tenure", value: avgTenure, note: avgTenure === 1 ? "year" : "years" },
  ];

  // ── Approval queue ──────────────────────────────────────────────────
  const pendingRows: PendingLeave[] = pending.map((r) => ({
    id: r.id,
    name: r.employee.name,
    initials: initialsOf(r.employee.name),
    detail: `${r.days} ${r.days === 1 ? "day" : "days"} ${r.type.toLowerCase()} leave`,
    range: dateRange(r.startDate, r.endDate),
    department: r.employee.department?.name ?? null,
  }));

  // ── Who's out this week ─────────────────────────────────────────────
  const outRows: OutRow[] = outThisWeek.map((l) => ({
    id: l.id,
    name: l.employee.name,
    initials: initialsOf(l.employee.name),
    department: l.employee.department?.name ?? null,
    type: l.type,
    range: dateRange(l.startDate, l.endDate),
    returnsTomorrow: l.endDate === todayStr, // last day off is today
  }));

  // ── Work anniversaries in the next 30 days ──────────────────────────
  // Take each start date, move it to this year (or next year if it has
  // already passed), and keep the ones coming up soon.
  const upcoming = employees
    .map((e) => {
      const start = parseDay(e.startedAt);
      let next = new Date(today.getFullYear(), start.getMonth(), start.getDate());
      if (next < today) next = new Date(today.getFullYear() + 1, start.getMonth(), start.getDate());
      const daysAway = Math.round((next.getTime() - today.getTime()) / DAY);
      return { e, next, daysAway, years: next.getFullYear() - start.getFullYear() };
    })
    .filter((m) => m.years >= 1 && m.daysAway <= 30)
    .sort((a, b) => a.daysAway - b.daysAway);
  const celebrations: Celebration[] = upcoming.slice(0, 5).map((m) => ({
    id: m.e.id,
    name: m.e.name,
    years: m.years,
    when: m.daysAway === 0 ? "today" : m.daysAway === 1 ? "tomorrow" : short(m.next),
  }));
  const anniversariesThisWeek = upcoming.filter((m) => m.daysAway <= 6).length;

  // ── New faces: the three most recent starters ───────────────────────
  const faces: Face[] = [...employees]
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    .slice(0, 3)
    .map((e) => ({
      id: e.id,
      name: e.name,
      initials: initialsOf(e.name),
      role: e.role,
      department: e.department?.name ?? null,
      joined: relativeDay(e.startedAt, today),
      startDate: parseDay(e.startedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    }));

  // ── Departments (largest first, empty ones hidden) ──────────────────
  const departments: DeptShare[] = deptRecords
    .map((d) => ({ department: d.name, employees: d._count.employees }))
    .filter((d) => d.employees > 0)
    .sort((a, b) => b.employees - a.employees);
  const assigned = departments.reduce((s, d) => s + d.employees, 0);
  const statusCount = (st: string) => employees.filter((e) => e.status === st).length;
  const statusLine = `Active ${statusCount("Active")} · On leave ${statusCount("On Leave")} · Remote ${statusCount("Remote")}`;

  // ── Greeting ────────────────────────────────────────────────────────
  const hour = Math.floor(minutesOfDay(now.toISOString()) / 60); // business time zone, not server UTC
  const partOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const firstName = (session?.user?.name ?? "there").split(" ")[0];
  const dateLine = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: APP_TIME_ZONE });

  // A one-sentence summary, built only from real facts.
  const backTomorrow = outRows.find((r) => r.returnsTomorrow);
  const facts = [
    canApprove && pendingCount > 0
      ? `${countWord(pendingCount)} ${pendingCount === 1 ? "request is" : "requests are"} waiting on you`
      : null,
    backTomorrow ? `${backTomorrow.name.split(" ")[0]} is back tomorrow` : null,
    anniversariesThisWeek > 0
      ? `${countWord(anniversariesThisWeek)} work ${anniversariesThisWeek === 1 ? "anniversary" : "anniversaries"} this week`
      : null,
  ].filter((f): f is string => !!f);
  const sentence = facts.length ? `${joinWords(facts)}.` : "Here's what's happening across your organization today.";
  const summary = sentence.charAt(0).toUpperCase() + sentence.slice(1);

  return (
    <div className="space-y-8 md:space-y-10">
      {/* 1 · Greeting */}
      <section className="space-y-2">
        <p className="flex items-center gap-2 text-ink-muted">
          <Caps>Daily dispatch</Caps>
          <span className="h-1 w-1 rounded-full bg-ink" />
          <Caps>
            {dateLine} · Week {isoWeek(today)}
          </Caps>
        </p>
        <div>
          <h1 className="font-display text-[36px] font-bold leading-[40px] tracking-[-0.02em] text-ink md:text-[48px] md:leading-[52px] md:tracking-[-0.03em]">
            Good {partOfDay}, {firstName}.
          </h1>
        </div>
        <p className="max-w-3xl text-body-lg text-ink-muted">{summary}</p>
      </section>

      {/* 2 · Navy hero band: big number + trajectory chart */}
      <HeroBand
        total={totalEmployees}
        teams={departments.length}
        joinedThisMonth={history[11]?.hires ?? 0}
        history={history}
      />

      {/* 3 · Slim ledger strip */}
      <section className="grid grid-cols-2 gap-y-6 border-y border-border py-6 md:grid-cols-4 md:divide-x md:divide-border">
        {ledger.map((m) => (
          <div key={m.label} className="space-y-1 md:px-6 md:first:pl-0">
            <Caps className="block text-ink-muted">{m.label}</Caps>
            <p className="flex flex-wrap items-baseline gap-x-1.5">
              <span className="tnum font-display text-[28px] font-semibold leading-8 text-ink">{m.value}</span>
              <span className="text-body-sm text-ink-muted">{m.note}</span>
            </p>
          </div>
        ))}
      </section>

      {/* 4 · Attention queue (approvers only) + who's out & celebrations */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {canApprove && (
          <div className="space-y-4 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-headline-sm text-ink">
                Needs your attention
                {pendingCount > 0 && (
                  <span className="tnum grid h-6 min-w-6 place-items-center rounded-full bg-navy px-1.5 font-sans text-[11px] font-bold text-on-navy">
                    {pendingCount}
                  </span>
                )}
              </h2>
              <Link href="/leave" className="group inline-flex items-center gap-1 text-ink-muted transition-colors hover:text-ink">
                <Caps>All leave requests</Caps>
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <ApprovalQueue requests={pendingRows} />
          </div>
        )}

        <div className={canApprove ? "space-y-6 lg:col-span-5" : "grid grid-cols-1 gap-6 md:grid-cols-2 lg:col-span-12"}>
          <OutThisWeek rows={outRows} />
          <Celebrations items={celebrations} />
        </div>
      </section>

      {/* 5 · New faces */}
      <NewFaces faces={faces} recent={newHires30 > 0} total={totalEmployees} />

      {/* 6 · Department split */}
      <AcrossCompany departments={departments} assigned={assigned} statusLine={statusLine} />

      <p className="text-body-sm text-ink-muted">
        {pipeline} {pipeline === 1 ? "candidate is" : "candidates are"} in the hiring pipeline ·{" "}
        <Link href="/recruitment" className="font-medium text-ink underline-offset-4 hover:underline">
          Go to recruitment
        </Link>
      </p>
    </div>
  );
}
