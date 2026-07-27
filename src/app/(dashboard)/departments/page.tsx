import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageDepartments } from "@/lib/permissions";
import DepartmentsManager from "@/components/departments/DepartmentsManager";
import type { DepartmentRow } from "@/lib/department-actions";

// Runs on the SERVER before the page is sent to the browser.
export default async function DepartmentsPage() {
  const session = await auth();
  const canManage = canManageDepartments(session?.user?.role);

  // Fetch departments, and ask the DB to count each one's related employees
  // in the same query (via the relation's `_count`). This counts by id, so
  // it's exact even if two departments were ever named similarly.
  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { employees: true } } },
  });

  const rows: DepartmentRow[] = departments.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    employeeCount: d._count.employees,
  }));

  return <DepartmentsManager initialDepartments={rows} canManage={canManage} />;
}
