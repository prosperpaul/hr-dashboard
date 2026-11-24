import { Clock } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageAttendance } from "@/lib/permissions";
import { todayISO, type AttendanceRow } from "@/lib/attendance";
import AttendanceManager from "@/components/attendance/AttendanceManager";
import MyAttendance from "@/components/attendance/MyAttendance";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

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
    // Approved leave is read too, so the phone roster can group people who
    // are off on approved leave instead of listing them as "not checked in".
    const [records, employees, leave] = await Promise.all([
      prisma.attendanceRecord.findMany({
        orderBy: [{ date: "desc" }, { clockIn: "asc" }],
        include: { employee: { select: { name: true } } },
      }),
      prisma.employee.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, role: true, email: true, startedAt: true, department: { select: { name: true } } },
      }),
      prisma.leaveRequest.findMany({
        where: { status: "Approved" },
        select: { employeeId: true, type: true, startDate: true, endDate: true },
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
        leave={leave}
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
    <div>
      <PageHeader eyebrow="Operations • Attendance" title="Clock in, clock out." className="border-b border-border pb-6" />
      <EmptyState
        icon={Clock}
        title="Your account isn’t linked yet"
        description="Ask an administrator to link your login to your employee record, then you’ll be able to clock in and out here."
        className="rounded-xl border border-border bg-surface"
      />
    </div>
  );
}
