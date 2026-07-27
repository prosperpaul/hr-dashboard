import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { computePayslip } from "../src/lib/payroll";

const prisma = new PrismaClient();

// email -> annual gross salary
const salaries: Record<string, number> = {
  "amara.okafor@company.com": 120000,
  "daniel.reyes@company.com": 95000,
  "priya.nair@company.com": 105000,
  "marcus.lee@company.com": 68000,
  "sofia.rossi@company.com": 88000,
  "james.carter@company.com": 165000,
  "lin.wei@company.com": 122000,
  "fatima.hassan@company.com": 82000,
  "oliver.grant@company.com": 140000,
  "chloe.bennett@company.com": 110000,
  "diego.martinez@company.com": 66000,
  "hana.kim@company.com": 98000,
  "noah.williams@company.com": 128000,
  "aisha.bello@company.com": 72000,
  "ethan.brooks@company.com": 90000,
  "mia.zhang@company.com": 78000,
};

async function main() {
  console.log("Seeding payroll…");
  await prisma.payslip.deleteMany();
  await prisma.payRun.deleteMany();

  // 1. Set salaries.
  let salaryCount = 0;
  for (const [email, salary] of Object.entries(salaries)) {
    const res = await prisma.employee.updateMany({ where: { email }, data: { salary } });
    salaryCount += res.count;
  }

  // 2. Create one FINALIZED past run so there's history to view.
  const run = await prisma.payRun.create({ data: { period: "2026-06", status: "Finalized" } });
  const employees = await prisma.employee.findMany({
    where: { salary: { gt: 0 } },
    select: { id: true, salary: true },
  });
  await prisma.payslip.createMany({
    data: employees.map((e) => {
      const { gross, deductions, net } = computePayslip(e.salary);
      return { payRunId: run.id, employeeId: e.id, gross, deductions, net };
    }),
  });

  console.log(`Done. ${salaryCount} salaries set; run 2026-06 with ${employees.length} payslips (Finalized).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
