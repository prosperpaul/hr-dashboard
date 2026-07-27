import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { initialsOf } from "@/lib/sample-data";
import { todayISO } from "@/lib/attendance";
import StatCard, { type DashStat } from "@/components/dashboard/StatCard";
import Panel from "@/components/dashboard/Panel";
import HeadcountChart, { type HeadcountPoint } from "@/components/dashboard/HeadcountChart";
import DepartmentChart, { type DeptPoint } from "@/components/dashboard/DepartmentChart";
import RecentHires, { type RecentHire } from "@/components/dashboard/RecentHires";

// Local YYYY-MM-DD for a date.
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// "2 days ago" / "3 weeks ago" style from an ISO date up to today.
function relativeDay(dateISO: string, now: Date): string {
  const then = new Date(`${dateISO}T00:00:00`);
  const days = Math.floor((now.getTime() - then.getTime()) / 86_400_000);
  if (isNaN(days)) return dateISO;
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null; // avoid divide-by-zero / meaningless %
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export default async function OverviewPage() {
  const session = await auth();
  const now = new Date();
  const today = todayISO();
  const cutoff30 = ymd(new Date(now.getTime() - 30 * 86_400_000));
  const cutoff60 = ymd(new Date(now.getTime() - 60 * 86_400_000));

  // One round of queries.
  const [employees, deptRecords, onLeaveToday, openRoles] = await Promise.all([
    prisma.employee.findMany({
      select: { id: true, name: true, role: true, startedAt: true, department: { select: { name: true } } },
    }),
    prisma.department.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { employees: true } } },
    }),
    prisma.leaveRequest.count({
      where: { status: "Approved", startDate: { lte: today }, endDate: { gte: today } },
    }),
    prisma.job.count({ where: { status: "Open" } }),
  ]);

  const totalEmployees = employees.length;

  // New hires in the last 30 days vs the previous 30 days.
  const newHires30 = employees.filter((e) => e.startedAt >= cutoff30).length;
  const prevHires30 = employees.filter((e) => e.startedAt >= cutoff60 && e.startedAt < cutoff30).length;

  // Headcount over the last 12 months, derived from actual start dates
  // (cumulative: everyone who had started by the end of each month).
  const headcount: HeadcountPoint[] = [];
  for (let i = 11; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = ymd(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
    const count = employees.filter((e) => e.startedAt <= monthEnd).length;
    headcount.push({ month: monthDate.toLocaleString("en-US", { month: "short" }), headcount: count });
  }
  const headThisMonth = headcount[headcount.length - 1]?.headcount ?? totalEmployees;
  const headLastMonth = headcount[headcount.length - 2]?.headcount ?? headThisMonth;

  const stats: DashStat[] = [
    {
      key: "employees",
      label: "Total Employees",
      value: String(totalEmployees),
      deltaPct: pctChange(headThisMonth, headLastMonth),
      upIsGood: true,
      spark: headcount.map((h) => h.headcount),
    },
    {
      key: "hires",
      label: "New Hires (30d)",
      value: String(newHires30),
      deltaPct: pctChange(newHires30, prevHires30),
      upIsGood: true,
    },
    {
      key: "leave",
      label: "On Leave Today",
      value: String(onLeaveToday),
      hint: "Approved time-off covering today",
    },
    {
      key: "roles",
      label: "Open Roles",
      value: String(openRoles),
      hint: "Positions currently hiring",
    },
  ];

  // Department breakdown (only departments that have people), largest first.
  const departments: DeptPoint[] = deptRecords
    .map((d) => ({ department: d.name, employees: d._count.employees }))
    .filter((d) => d.employees > 0)
    .sort((a, b) => b.employees - a.employees);

  // Five most recent hires.
  const recentHires: RecentHire[] = [...employees]
    .sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))
    .slice(0, 5)
    .map((e) => ({
      id: e.id,
      name: e.name,
      role: e.role,
      department: e.department?.name ?? "—",
      startedAt: relativeDay(e.startedAt, now),
      initials: initialsOf(e.name),
    }));

  const hour = now.getHours();
  const partOfDay = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
  const firstName = (session?.user?.name ?? "there").split(" ")[0];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">
          Good {partOfDay}, {firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Here&apos;s what&apos;s happening across your organization today.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.key} stat={stat} />
        ))}
      </div>

      {/* Headcount chart (wide) + recent hires (narrow) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          title="Headcount growth"
          subtitle="Total employees over the last 12 months"
          className="lg:col-span-2"
        >
          <HeadcountChart data={headcount} />
        </Panel>

        <Panel title="Recent hires" subtitle="Newest team members">
          <RecentHires hires={recentHires} />
        </Panel>
      </div>

      {/* Department breakdown (full width) */}
      <Panel title="Employees by department" subtitle="Where your people work">
        <DepartmentChart data={departments} />
      </Panel>
    </div>
  );
}
