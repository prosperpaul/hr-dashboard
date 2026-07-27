import { CalendarDays } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageLeave } from "@/lib/permissions";
import LeaveManager from "@/components/leave/LeaveManager";
import type { LeaveRow } from "@/lib/leave";

// Runs on the SERVER before the page is sent to the browser.
export default async function LeavePage() {
  const session = await auth();
  const canManage = canManageLeave(session?.user?.role);

  // Find the Employee this login represents (for self-service).
  const me = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          employeeId: true,
          employee: { select: { id: true, name: true, leaveAllowance: true } },
        },
      })
    : null;
  const myEmployeeId = me?.employeeId ?? null;

  // --- Manager / HR / Admin: see and manage EVERYONE's leave ---
  if (canManage) {
    const [records, employees] = await Promise.all([
      prisma.leaveRequest.findMany({
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        include: { employee: { select: { name: true } } },
      }),
      prisma.employee.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);
    return (
      <LeaveManager
        initialRequests={records.map(toRow)}
        employees={employees}
        canManage
        selfEmployeeId={myEmployeeId}
      />
    );
  }

  // --- Not a manager and not linked: nothing to show yet ---
  if (!myEmployeeId) {
    return <NotLinked />;
  }

  // --- Self-service: a linked employee sees & requests ONLY their own leave ---
  const records = await prisma.leaveRequest.findMany({
    where: { employeeId: myEmployeeId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { employee: { select: { name: true } } },
  });
  return (
    <LeaveManager
      initialRequests={records.map(toRow)}
      employees={me?.employee ? [me.employee] : []}
      canManage={false}
      selfEmployeeId={myEmployeeId}
      allowance={me?.employee?.leaveAllowance ?? null}
    />
  );
}

// Shared row mapper (DB record → UI shape).
function toRow(r: {
  id: string;
  employeeId: string;
  employee: { name: string };
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: string;
}): LeaveRow {
  return {
    id: r.id,
    employeeId: r.employeeId,
    employeeName: r.employee.name,
    type: r.type,
    startDate: r.startDate,
    endDate: r.endDate,
    days: r.days,
    reason: r.reason,
    status: r.status,
  };
}

// Shown to non-managers whose account isn't linked to an employee record.
function NotLinked() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Leave</h1>
      <div className="grid place-items-center rounded-2xl border border-border bg-surface py-16 text-center">
        <div className="max-w-sm">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-surface-2">
            <CalendarDays className="h-5 w-5 text-ink-faint" />
          </div>
          <p className="mt-3 text-sm font-medium text-ink">Your account isn&apos;t linked yet</p>
          <p className="mt-1 text-sm text-ink-muted">
            Ask an administrator to link your login to your employee record, then
            you&apos;ll be able to request and track your time off here.
          </p>
        </div>
      </div>
    </div>
  );
}
