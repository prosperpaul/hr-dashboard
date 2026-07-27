import { Receipt } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManagePayroll } from "@/lib/permissions";
import type { SalaryRow, PayRunRow, MyPayslipRow } from "@/lib/payroll";
import PayrollManager from "@/components/payroll/PayrollManager";
import MyPayslips from "@/components/payroll/MyPayslips";

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

    return <PayrollManager salaries={salaries} payRuns={payRuns} />;
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
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Payroll</h1>
      <div className="grid place-items-center rounded-2xl border border-border bg-surface py-16 text-center">
        <div className="max-w-sm">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-surface-2">
            <Receipt className="h-5 w-5 text-ink-faint" />
          </div>
          <p className="mt-3 text-sm font-medium text-ink">Your account isn&apos;t linked yet</p>
          <p className="mt-1 text-sm text-ink-muted">
            Ask an administrator to link your login to your employee record, then
            your payslips will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}
