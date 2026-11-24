import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageEmployees } from "@/lib/permissions";
import { todayISO } from "@/lib/attendance";
import EmployeesManager from "@/components/employees/EmployeesManager";
import type { Employee, EmployeeStatus } from "@/lib/sample-data";

// This runs on the SERVER before the page is sent to the browser.
// `searchParams` = the ?q=… part of the URL. The top-bar search box sends
// people here with their search text, e.g. /employees?q=amara.
export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const focusSearch = params.search === "1";

  // Who's viewing, and are they allowed to edit? (Same rule the server
  // actions enforce — imported from one shared place.)
  const session = await auth();
  const canManage = canManageEmployees(session?.user?.role);

  // Ask the database for all employees (newest first) AND the department list
  // (for the form dropdown + filter), in parallel.
  const [records, departments, me] = await Promise.all([
    prisma.employee.findMany({
      orderBy: { createdAt: "desc" },
      include: { department: true }, // pull each employee's related department
    }),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    // Which employee record is "you" (to tag your own row).
    session?.user?.id
      ? prisma.user.findUnique({ where: { id: session.user.id }, select: { employeeId: true } })
      : Promise.resolve(null),
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
      // A new search remounts the list so it starts from the new text.
      key={q}
      initialQuery={q}
      focusSearch={focusSearch}
      employees={employees}
      departments={departments}
      canManage={canManage}
      myEmployeeId={me?.employeeId ?? null}
      today={todayISO()}
    />
  );
}
