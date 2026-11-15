import { CalendarDays } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageLeave } from "@/lib/permissions";
import { todayISO } from "@/lib/attendance";
import LeaveManager from "@/components/leave/LeaveManager";
import type { LeaveRow, LeaveEmployee } from "@/lib/leave";

// What we load for each request: the request + who it belongs to.
const requestInclude = {
  employee: { select: { name: true, department: { select: { name: true } } } },
} as const;

// What we load for each employee (balances table + request form).
const employeeSelect = {
  id: true,
  name: true,
  email: true,
  leaveAllowance: true,
  department: { select: { name: true } },
} as const;

// Runs on the SERVER before the page is sent to the browser.
export default async function LeavePage() {
  const session = await auth();
  const canManage = canManageLeave(session?.user?.role);
  const today = todayISO(); // decided on the server so server & browser agree

  // Find the Employee this login represents (for self-service).
  const me = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { employeeId: true, employee: { select: employeeSelect } },
      })
    : null;
  const myEmployeeId = me?.employeeId ?? null;

  // --- Manager / HR / Admin: see and manage EVERYONE's leave ---
  if (canManage) {
    const [records, employees] = await Promise.all([
      prisma.leaveRequest.findMany({ orderBy: { startDate: "asc" }, include: requestInclude }),
      prisma.employee.findMany({ orderBy: { name: "asc" }, select: employeeSelect }),
    ]);
    return (
      <LeaveManager
        requests={records.map(toRow)}
        employees={employees.map(toEmployee)}
        canManage
        selfEmployeeId={myEmployeeId}
        today={today}
      />
    );
  }

  // --- Not a manager and not linked: nothing to show yet ---
  if (!myEmployeeId || !me?.employee) {
    return <NotLinked />;
  }

  // --- Self-service: a linked employee sees & requests ONLY their own leave ---
  const records = await prisma.leaveRequest.findMany({
    where: { employeeId: myEmployeeId },
    orderBy: { startDate: "asc" },
    include: requestInclude,
  });
  return (
    <LeaveManager
      requests={records.map(toRow)}
      employees={[toEmployee(me.employee)]}
      canManage={false}
      selfEmployeeId={myEmployeeId}
      today={today}
    />
  );
}

// DB record → UI shape.
function toRow(r: {
  id: string;
  employeeId: string;
  employee: { name: string; department: { name: string } | null };
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: string;
  createdAt: Date;
}): LeaveRow {
  return {
    id: r.id,
    employeeId: r.employeeId,
    employeeName: r.employee.name,
    department: r.employee.department?.name ?? null,
    type: r.type,
    startDate: r.startDate,
    endDate: r.endDate,
    days: r.days,
    reason: r.reason,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  };
}

function toEmployee(e: {
  id: string;
  name: string;
  email: string;
  leaveAllowance: number;
  department: { name: string } | null;
}): LeaveEmployee {
  return { id: e.id, name: e.name, email: e.email, leaveAllowance: e.leaveAllowance, department: e.department?.name ?? null };
}

// Shown to non-managers whose account isn't linked to an employee record.
function NotLinked() {
  return (
    <div className="space-y-6">
      <h1 className="text-headline-lg text-ink md:text-headline-xl">Leave</h1>
      <div className="grid place-items-center rounded-xl border border-border bg-surface py-16 text-center">
        <div className="max-w-sm">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface-2">
            <CalendarDays className="h-5 w-5 text-ink-faint" />
          </div>
          <p className="mt-3 text-headline-sm text-ink">Your account isn&apos;t linked yet</p>
          <p className="mt-1 text-body-md text-ink-muted">
            Ask an administrator to link your login to your employee record, then
            you&apos;ll be able to request and track your time off here.
          </p>
        </div>
      </div>
    </div>
  );
}
