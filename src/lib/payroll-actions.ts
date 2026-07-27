"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManagePayroll } from "@/lib/permissions";
import { computePayslip } from "@/lib/payroll";

async function assertCanManage(): Promise<void> {
  const session = await auth();
  if (!canManagePayroll(session?.user?.role)) {
    throw new Error("Not authorized to manage payroll.");
  }
}

// Set an employee's annual salary.
export async function setSalary(employeeId: string, salary: number): Promise<void> {
  await assertCanManage();
  if (!Number.isInteger(salary) || salary < 0) {
    throw new Error("Salary must be a whole number of 0 or more.");
  }
  await prisma.employee.update({ where: { id: employeeId }, data: { salary } });
  revalidatePath("/payroll");
}

// Create a pay run for a period and generate a payslip for every employee
// who has a salary set. Amounts are snapshotted at generation time.
export async function createPayRun(period: string): Promise<void> {
  await assertCanManage();
  const p = period.trim();
  if (!p) throw new Error("Please enter a pay period (e.g. 2026-07).");

  let run;
  try {
    run = await prisma.payRun.create({ data: { period: p, status: "Draft" } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error(`A pay run already exists for ${p}.`);
    }
    throw err;
  }

  const employees = await prisma.employee.findMany({
    where: { salary: { gt: 0 } },
    select: { id: true, salary: true },
  });

  if (employees.length === 0) {
    throw new Error("No employees have a salary set yet. Set salaries first.");
  }

  await prisma.payslip.createMany({
    data: employees.map((e) => {
      const { gross, deductions, net } = computePayslip(e.salary);
      return { payRunId: run.id, employeeId: e.id, gross, deductions, net };
    }),
  });
  revalidatePath("/payroll");
}

// Lock a run so it's final.
export async function finalizePayRun(id: string): Promise<void> {
  await assertCanManage();
  await prisma.payRun.update({ where: { id }, data: { status: "Finalized" } });
  revalidatePath("/payroll");
}

// Delete a run (and its payslips, via cascade).
export async function deletePayRun(id: string): Promise<void> {
  await assertCanManage();
  await prisma.payRun.delete({ where: { id } });
  revalidatePath("/payroll");
}
