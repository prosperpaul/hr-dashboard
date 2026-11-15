import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { computePayslip } from "../src/lib/payroll";

const prisma = new PrismaClient();

// email -> annual gross salary in NAIRA (₦)
const salaries: Record<string, number> = {
  "amara.okafor@company.com": 12_000_000,
  "daniel.reyes@company.com": 9_500_000,
  "priya.nair@company.com": 10_500_000,
  "marcus.lee@company.com": 6_800_000,
  "sofia.rossi@company.com": 8_800_000,
  "james.carter@company.com": 16_500_000,
  "lin.wei@company.com": 12_200_000,
  "fatima.hassan@company.com": 8_200_000,
  "oliver.grant@company.com": 14_000_000,
  "chloe.bennett@company.com": 11_000_000,
  "diego.martinez@company.com": 6_600_000,
  "hana.kim@company.com": 9_800_000,
  "noah.williams@company.com": 12_800_000,
  "aisha.bello@company.com": 7_200_000,
  "ethan.brooks@company.com": 9_000_000,
  "mia.zhang@company.com": 7_800_000,
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
