import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageDepartments } from "@/lib/permissions";
import { initialsOf } from "@/lib/sample-data";
import DepartmentsManager, { type DeptCard } from "@/components/departments/DepartmentsManager";

const DAY = 86_400_000;

// Local YYYY-MM-DD for a date (start dates are stored as these strings).
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Runs on the SERVER before the page is sent to the browser.
export default async function DepartmentsPage() {
  const session = await auth();
  const canManage = canManageDepartments(session?.user?.role);

  // Two queries in parallel:
  //  1. every department with its people (just the fields we need) and a
  //     count of its OPEN jobs, counted by the database;
  //  2. total company headcount (includes people with no department).
  const [departments, totalEmployees] = await Promise.all([
    prisma.department.findMany({
      orderBy: { name: "asc" },
      include: {
        employees: { select: { id: true, name: true, role: true, startedAt: true }, orderBy: { startedAt: "asc" } },
        _count: { select: { employees: true, jobs: { where: { status: "Open" } } } },
      },
    }),
    prisma.employee.count(),
  ]);

  const now = new Date();
  // Month-end dates for the last 12 months, oldest first ("2025-12-31" …).
  const monthEnds = Array.from({ length: 12 }, (_, i) =>
    ymd(new Date(now.getFullYear(), now.getMonth() - 11 + i + 1, 0)),
  );
  const yearAgo = ymd(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()));
  const quarterAgo = ymd(new Date(now.getTime() - 90 * DAY));

  const cards: DeptCard[] = departments.map((d) => {
    const people = d.employees;
    const count = d._count.employees;

    // Headcount at each month end = people who had started by then.
    const history = monthEnds.map((end) => people.filter((p) => p.startedAt <= end).length);

    // Growth vs a year ago (null when there was nobody to compare with).
    const before = people.filter((p) => p.startedAt <= yearAgo).length;
    const growthPct = before > 0 ? Math.round(((count - before) / before) * 1000) / 10 : null;

    // Most common job titles → shown as tags on the card.
    const roleCounts = people.reduce<Record<string, number>>((acc, p) => ({ ...acc, [p.role]: (acc[p.role] ?? 0) + 1 }), {});
    const topRoles = Object.entries(roleCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([role]) => role);

    return {
      id: d.id,
      name: d.name,
      description: d.description,
      employeeCount: count,
      openRoles: d._count.jobs,
      history,
      growthPct,
      newThisQuarter: people.filter((p) => p.startedAt >= quarterAgo).length,
      topRoles,
      roleCount: Object.keys(roleCounts).length,
      // Only a few faces for the avatar stack — the rest become "+N".
      members: people.slice(0, 4).map((p) => ({ id: p.id, initials: initialsOf(p.name), name: p.name })),
    };
  });

  return <DepartmentsManager departments={cards} totalEmployees={totalEmployees} canManage={canManage} />;
}
