import { Receipt } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManagePayroll } from "@/lib/permissions";
import { todayISO } from "@/lib/attendance";
import type { SalaryRow, PayRunRow, MyPayslipRow } from "@/lib/payroll";
import PayrollManager from "@/components/payroll/PayrollManager";
import MyPayslips from "@/components/payroll/MyPayslips";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";

export default async function PayrollPage() {
  const session = await auth();
  const canManage = canManagePayroll(session?.user?.role);

  // --- Admin / HR: full payroll (salaries + pay runs) ---
  if (canManage) {
    const [employees, runRecords] = await Promise.all([
      prisma.employee.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, salary: true, department: { select: { name: true } } },
      }),
      prisma.payRun.findMany({
        orderBy: { period: "desc" },
        include: { payslips: { include: { employee: { select: { name: true } } } } },
      }),
    ]);

    const salaries: SalaryRow[] = employees.map((e) => ({
      employeeId: e.id,
      name: e.name,
      department: e.department?.name ?? "—",
      salary: e.salary,
    }));

    const payRuns: PayRunRow[] = runRecords.map((r) => ({
      id: r.id,
      period: r.period,
      status: r.status,
      payslips: r.payslips.map((p) => ({
        id: p.id,
        employeeId: p.employeeId,
        employeeName: p.employee.name,
        gross: p.gross,
        deductions: p.deductions,
        net: p.net,
      })),
    }));

    // Today's date is decided on the SERVER and passed down, so the server
    // render and the browser render agree ("pays out in 5 days").
    return <PayrollManager salaries={salaries} payRuns={payRuns} today={todayISO()} />;
  }

  // --- Self-service: a linked employee sees their own FINALIZED payslips ---
  const me = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { employeeId: true },
      })
    : null;

  if (!me?.employeeId) return <NotLinked />;

  const records = await prisma.payslip.findMany({
    where: { employeeId: me.employeeId, payRun: { status: "Finalized" } },
    orderBy: { createdAt: "desc" },
    include: { payRun: { select: { period: true } } },
  });

  const payslips: MyPayslipRow[] = records.map((p) => ({
    id: p.id,
    period: p.payRun.period,
    gross: p.gross,
    deductions: p.deductions,
    net: p.net,
  }));

  return <MyPayslips payslips={payslips} />;
}

function NotLinked() {
  return (
    <div className="min-w-0">
      <PageHeader eyebrow="Payroll · My payslips" title="My payslips." />
      <div className="rounded-xl border border-border bg-surface">
        <EmptyState
          icon={Receipt}
          title="Your account isn't linked yet"
          description="Ask an administrator to link your login to your employee record, then your payslips will appear here."
        />
      </div>
    </div>
  );
}
