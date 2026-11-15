import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageLeave } from "@/lib/permissions";
import { initialsOf } from "@/lib/sample-data";
import { todayISO, minutesOfDay, APP_TIME_ZONE } from "@/lib/attendance";
import StatCard, { type DashStat } from "@/components/dashboard/StatCard";
import Panel, { Pill } from "@/components/dashboard/Panel";
import HeadcountChart, { type HeadcountPoint } from "@/components/dashboard/HeadcountChart";
import DepartmentChart, { type DeptPoint } from "@/components/dashboard/DepartmentChart";
import RecentHires, { type RecentHire } from "@/components/dashboard/RecentHires";
import ApprovalQueue, { type PendingLeave } from "@/components/dashboard/ApprovalQueue";
import Milestones, { type Milestone } from "@/components/dashboard/Milestones";

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

// Compact "3d ago" / "2w ago" / "4mo ago".
function relativeDay(dateISO: string, today: Date): string {
  const days = Math.floor((today.getTime() - parseDay(dateISO).getTime()) / DAY);
  if (isNaN(days)) return dateISO;
  if (days <= 0) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 35) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null; // avoid divide-by-zero / meaningless %
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

const signed = (n: number) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`);

export default async function OverviewPage() {
  const session = await auth();
  const canApprove = canManageLeave(session?.user?.role);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // midnight
  const todayStr = todayISO();
  const cutoff30 = ymd(new Date(today.getTime() - 30 * DAY));
  const cutoff60 = ymd(new Date(today.getTime() - 60 * DAY));
  const weekAhead = ymd(new Date(today.getTime() + 6 * DAY));

  // Everything the page needs, fetched in ONE parallel round of queries.
  const [employees, deptRecords, onLeave, openRoles, pipeline, finalRound, pending, pendingCount] =
    await Promise.all([
      prisma.employee.findMany({
        select: { id: true, name: true, role: true, startedAt: true, department: { select: { name: true } } },
      }),
      prisma.department.findMany({ include: { _count: { select: { employees: true } } } }),
      // Who is off today (approved leave whose date range covers today).
      prisma.leaveRequest.findMany({
        where: { status: "Approved", startDate: { lte: todayStr }, endDate: { gte: todayStr } },
        select: { type: true, endDate: true },
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
            select: { id: true, type: true, days: true, startDate: true, endDate: true, employee: { select: { name: true } } },
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
      label: first.toLocaleString("en-US", { month: "long", year: "numeric" }),
      headcount: employees.filter((e) => e.startedAt <= monthEnd).length,
      hires: employees.filter((e) => e.startedAt >= monthStart && e.startedAt <= monthEnd).length,
    });
  }
  const thisMonth = history[11];
  const lastMonth = history[10];

  // ── KPI cards ───────────────────────────────────────────────────────
  const newHires30 = employees.filter((e) => e.startedAt >= cutoff30).length;
  const prevHires30 = employees.filter((e) => e.startedAt >= cutoff60 && e.startedAt < cutoff30).length;
  const headDelta = pctChange(thisMonth.headcount, lastMonth.headcount);

  // Leave today, grouped by type, biggest group first.
  const leaveByType = Object.entries(
    onLeave.reduce<Record<string, number>>((acc, l) => ({ ...acc, [l.type]: (acc[l.type] ?? 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1]);
  const leaveColors = ["bg-accent", "bg-accent/40", "bg-ink-faint", "bg-border-strong"];
  const returningThisWeek = onLeave.filter((l) => l.endDate <= weekAhead).length;
  const leavePct = totalEmployees ? Math.round((onLeave.length / totalEmployees) * 1000) / 10 : 0;

  const stats: DashStat[] = [
    {
      key: "employees",
      label: "Total Employees",
      value: String(totalEmployees),
      badge:
        headDelta !== null && headDelta !== 0
          ? { text: `${headDelta > 0 ? "+" : "−"}${Math.abs(headDelta)}%`, trend: headDelta > 0 ? "up" : "down" }
          : undefined,
      spark: history.map((h) => h.headcount),
      footer: { label: "Joined this month", value: signed(thisMonth.hires), accent: thisMonth.hires > 0 },
    },
    {
      key: "hires",
      label: "New Hires (30d)",
      value: String(newHires30),
      badge: { text: `${signed(newHires30 - prevHires30)} vs prev 30d`, tone: newHires30 >= prevHires30 ? "accent" : "neutral" },
      spark: history.slice(-6).map((h) => h.hires),
      footer: { label: "Previous 30 days", value: String(prevHires30) },
    },
    {
      key: "leave",
      label: "On Leave Today",
      value: String(onLeave.length),
      badge: { text: `${leavePct}% of team`, tone: "neutral" },
      side:
        leaveByType.length > 0 ? (
          <div className="flex items-center gap-3 text-label-sm text-ink-faint">
            {leaveByType.slice(0, 2).map(([type, n], i) => (
              <span key={type} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${leaveColors[i]}`} />
                <span className="tnum">{n}</span> {type}
              </span>
            ))}
          </div>
        ) : undefined,
      bar: leaveByType.map(([, n], i) => ({ value: n, className: leaveColors[i] ?? "bg-border-strong" })),
      footer: { label: "Back within 7 days", value: `${returningThisWeek} ${returningThisWeek === 1 ? "person" : "people"}` },
    },
    {
      key: "roles",
      label: "Open Roles",
      value: String(openRoles),
      badge: openRoles > 0 ? { text: "Hiring active", dot: true } : { text: "Not hiring", tone: "neutral" },
      side:
        finalRound > 0 ? (
          <span className="rounded-md border border-border bg-surface-2 px-2 py-0.5 text-label-sm text-accent-hover">
            {finalRound} in final rounds
          </span>
        ) : undefined,
      footer: { label: "Active candidates", value: `${pipeline} in pipeline` },
    },
  ];

  // ── Approval queue ──────────────────────────────────────────────────
  const pendingRows: PendingLeave[] = pending.map((r) => ({
    id: r.id,
    name: r.employee.name,
    initials: initialsOf(r.employee.name),
    detail: `${r.type} · ${r.days} ${r.days === 1 ? "day" : "days"}`,
    range: dateRange(r.startDate, r.endDate),
  }));

  // ── Recent hires ────────────────────────────────────────────────────
  const recentHires: RecentHire[] = [...employees]
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    .slice(0, 4)
    .map((e) => ({
      id: e.id,
      name: e.name,
      role: e.role,
      department: e.department?.name ?? "—",
      startedAt: relativeDay(e.startedAt, today),
      initials: initialsOf(e.name),
    }));

  // ── Departments (largest first, empty ones hidden) ──────────────────
  const departments: DeptPoint[] = deptRecords
    .map((d) => ({ department: d.name, employees: d._count.employees }))
    .filter((d) => d.employees > 0)
    .sort((a, b) => b.employees - a.employees);
  const assigned = departments.reduce((s, d) => s + d.employees, 0);

  // ── Work anniversaries in the next 30 days ──────────────────────────
  // Take each start date, move it to this year (or next year if it has
  // already passed), and keep the ones coming up soon.
  const milestones: Milestone[] = employees
    .map((e) => {
      const start = parseDay(e.startedAt);
      let next = new Date(today.getFullYear(), start.getMonth(), start.getDate());
      if (next < today) next = new Date(today.getFullYear() + 1, start.getMonth(), start.getDate());
      const daysAway = Math.round((next.getTime() - today.getTime()) / DAY);
      return { e, next, daysAway, years: next.getFullYear() - start.getFullYear() };
    })
    .filter((m) => m.years >= 1 && m.daysAway <= 30)
    .sort((a, b) => a.daysAway - b.daysAway)
    .slice(0, 4)
    .map((m) => ({
      id: m.e.id,
      name: m.e.name,
      years: m.years,
      when: m.daysAway === 0 ? "Today" : m.daysAway === 1 ? "Tomorrow" : short(m.next),
      soon: m.daysAway <= 1,
    }));

  // ── Greeting ────────────────────────────────────────────────────────
  const hour = Math.floor(minutesOfDay(now.toISOString()) / 60); // business time zone, not server UTC
  const partOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const firstName = (session?.user?.name ?? "there").split(" ")[0];
  const dateLine = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: APP_TIME_ZONE });

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <section className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
          <span className="text-label-sm uppercase tracking-wider text-ink-faint">{dateLine}</span>
        </div>
        <h1 className="text-headline-lg text-ink md:text-headline-xl">
          Good {partOfDay}, {firstName}
        </h1>
        <p className="flex flex-wrap items-center gap-x-2 text-body-md text-ink-muted">
          {canApprove && pendingCount > 0 ? (
            <>
              <span>
                {pendingCount} leave {pendingCount === 1 ? "request needs" : "requests need"} your approval.
              </span>
              <Link
                href="/leave"
                className="group inline-flex items-center gap-1 text-label-md text-accent transition-colors hover:text-accent-hover"
              >
                Review requests
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </>
          ) : (
            <span>Here&apos;s what&apos;s happening across your organization today.</span>
          )}
        </p>
      </section>

      {/* KPI cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.key} stat={stat} />
        ))}
      </section>

      {/* Growth chart (wide) + side stack */}
      <section className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <HeadcountChart data={history} />
        </div>

        <div className="space-y-6 lg:col-span-4">
          {canApprove && (
            <Panel
              id="approval-queue"
              title="Needs Attention"
              badge={pendingCount > 0 ? <Pill tone="accent">{pendingCount} pending</Pill> : undefined}
              action={
                <Link href="/leave" className="text-label-sm text-ink-faint transition-colors hover:text-ink">
                  All leave
                </Link>
              }
            >
              <ApprovalQueue requests={pendingRows} />
            </Panel>
          )}

          <Panel
            title="Recent Hires"
            subtitle="Newest team members"
            action={
              <Link href="/employees" className="text-label-sm text-accent transition-colors hover:text-accent-hover">
                Directory →
              </Link>
            }
          >
            <RecentHires hires={recentHires} />
          </Panel>
        </div>
      </section>

      {/* Departments + milestones */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Panel
          title="Department Breakdown"
          subtitle={`Organizational structure across ${assigned} assigned ${assigned === 1 ? "person" : "people"}`}
          className="lg:col-span-7"
        >
          <DepartmentChart data={departments} total={assigned} />
        </Panel>

        <Panel title="Team Milestones" subtitle="Work anniversaries · next 30 days" className="lg:col-span-5">
          <Milestones items={milestones} />
        </Panel>
      </section>
    </div>
  );
}
