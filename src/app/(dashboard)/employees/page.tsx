import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageEmployees } from "@/lib/permissions";
import EmployeesManager from "@/components/employees/EmployeesManager";
import type { Employee, EmployeeStatus } from "@/lib/sample-data";

// This runs on the SERVER before the page is sent to the browser.
export default async function EmployeesPage() {
  // Who's viewing, and are they allowed to edit? (Same rule the server
  // actions enforce — imported from one shared place.)
  const session = await auth();
  const canManage = canManageEmployees(session?.user?.role);

  // Ask the database for all employees (newest first) AND the department list
  // (for the form dropdown + filter), in parallel.
  const [records, departments] = await Promise.all([
    prisma.employee.findMany({
      orderBy: { createdAt: "desc" },
      include: { department: true }, // pull each employee's related department
    }),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  // Shape them into the clean type our table expects (resolve the dept name).
  const employees: Employee[] = records.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    departmentId: r.departmentId,
    department: r.department?.name ?? "Unassigned",
    status: r.status as EmployeeStatus,
    startedAt: r.startedAt,
    leaveAllowance: r.leaveAllowance,
  }));

  return (
    <EmployeesManager
      initialEmployees={employees}
      departments={departments}
      canManage={canManage}
    />
  );
}
