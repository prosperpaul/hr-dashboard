import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Inclusive day count between two ISO dates ("2026-08-03" .. "2026-08-07" = 5).
function dayCount(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86_400_000) + 1);
}

// Sample requests, keyed by employee email so we can look up the real id.
const samples = [
  { email: "amara.okafor@company.com", type: "Vacation", startDate: "2026-08-03", endDate: "2026-08-07", reason: "Family trip", status: "Approved" },
  { email: "daniel.reyes@company.com", type: "Sick",     startDate: "2026-07-22", endDate: "2026-07-23", reason: "Flu", status: "Approved" },
  { email: "priya.nair@company.com",   type: "Personal", startDate: "2026-08-10", endDate: "2026-08-10", reason: "Appointment", status: "Pending" },
  { email: "marcus.lee@company.com",   type: "Vacation", startDate: "2026-09-01", endDate: "2026-09-12", reason: "Honeymoon", status: "Pending" },
  { email: "sofia.rossi@company.com",  type: "Unpaid",   startDate: "2026-08-18", endDate: "2026-08-20", reason: null, status: "Rejected" },
  { email: "lin.wei@company.com",      type: "Sick",     startDate: "2026-07-28", endDate: "2026-07-29", reason: null, status: "Pending" },
];

async function main() {
  console.log("Seeding leave requests…");
  await prisma.leaveRequest.deleteMany(); // start clean so re-runs don't duplicate

  const employees = await prisma.employee.findMany({ select: { id: true, email: true } });
  const idByEmail = new Map(employees.map((e) => [e.email, e.id]));

  let created = 0;
  for (const s of samples) {
    const employeeId = idByEmail.get(s.email);
    if (!employeeId) {
      console.log(`  ! skipped ${s.email} (no matching employee)`);
      continue;
    }
    await prisma.leaveRequest.create({
      data: {
        employeeId,
        type: s.type,
        startDate: s.startDate,
        endDate: s.endDate,
        days: dayCount(s.startDate, s.endDate),
        reason: s.reason,
        status: s.status,
      },
    });
    created++;
  }

  console.log(`Done. ${created} leave requests seeded.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
