import { Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageAttendance } from "@/lib/permissions";
import { todayISO, type AttendanceRow } from "@/lib/attendance";
import AttendanceManager from "@/components/attendance/AttendanceManager";
import MyAttendance from "@/components/attendance/MyAttendance";

export default async function AttendancePage() {
  const session = await auth();
  const canManage = canManageAttendance(session?.user?.role);
  const today = todayISO();

  const me = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { employeeId: true, employee: { select: { name: true } } },
      })
    : null;
  const myEmployeeId = me?.employeeId ?? null;

  // --- Manager / HR / Admin: see EVERYONE's attendance ---
  if (canManage) {
    // Records + the full staff list (so we can also show who has NOT
    // clocked in on a given day), fetched in parallel.
    const [records, employees] = await Promise.all([
      prisma.attendanceRecord.findMany({
        orderBy: [{ date: "desc" }, { clockIn: "asc" }],
        include: { employee: { select: { name: true } } },
      }),
      prisma.employee.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, role: true, email: true, startedAt: true, department: { select: { name: true } } },
      }),
    ]);
    return (
      <AttendanceManager
        records={records.map(toRow)}
        employees={employees.map((e) => ({
          id: e.id,
          name: e.name,
          role: e.role,
          email: e.email,
          startedAt: e.startedAt,
          department: e.department?.name ?? null,
        }))}
        today={today}
      />
    );
  }

  // --- Not a manager and not linked ---
  if (!myEmployeeId) return <NotLinked />;

  // --- Self-service: clock in/out + own history ---
  const records = await prisma.attendanceRecord.findMany({
    where: { employeeId: myEmployeeId },
    orderBy: [{ date: "desc" }],
    include: { employee: { select: { name: true } } },
  });
  return (
    <MyAttendance
      initialRecords={records.map(toRow)}
      today={today}
      employeeName={me?.employee?.name ?? "You"}
    />
  );
}

function toRow(r: {
  id: string;
  employeeId: string;
  employee: { name: string };
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  status: string;
}): AttendanceRow {
  return {
    id: r.id,
    employeeId: r.employeeId,
    employeeName: r.employee.name,
    date: r.date,
    clockIn: r.clockIn,
    clockOut: r.clockOut,
    status: r.status,
  };
}

function NotLinked() {
  return (
    <div className="space-y-6">
      <h1 className="text-headline-lg text-ink md:text-headline-xl">Attendance</h1>
      <div className="grid place-items-center rounded-xl border border-border bg-surface py-16 text-center">
        <div className="max-w-sm">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface-2">
            <Clock className="h-5 w-5 text-ink-faint" />
          </div>
          <p className="mt-3 text-headline-sm text-ink">Your account isn&apos;t linked yet</p>
          <p className="mt-1 text-body-md text-ink-muted">
            Ask an administrator to link your login to your employee record, then
            you&apos;ll be able to clock in and out here.
          </p>
        </div>
      </div>
    </div>
  );
}
