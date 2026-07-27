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
    const records = await prisma.attendanceRecord.findMany({
      orderBy: [{ date: "desc" }, { clockIn: "asc" }],
      include: { employee: { select: { name: true } } },
    });
    return <AttendanceManager initialRecords={records.map(toRow)} today={today} />;
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
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Attendance</h1>
      <div className="grid place-items-center rounded-2xl border border-border bg-surface py-16 text-center">
        <div className="max-w-sm">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-surface-2">
            <Clock className="h-5 w-5 text-ink-faint" />
          </div>
          <p className="mt-3 text-sm font-medium text-ink">Your account isn&apos;t linked yet</p>
          <p className="mt-1 text-sm text-ink-muted">
            Ask an administrator to link your login to your employee record, then
            you&apos;ll be able to clock in and out here.
          </p>
        </div>
      </div>
    </div>
  );
}
