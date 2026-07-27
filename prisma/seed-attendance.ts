import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Local "YYYY-MM-DD" for an offset number of days from today.
function dayISO(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Naive-local ISO datetime for a given day + "HH:MM".
function at(dateISO: string, hhmm: string): string {
  return `${dateISO}T${hhmm}:00`;
}

const today = dayISO(0);
const yesterday = dayISO(-1);

// [email, date, clockIn|null, clockOut|null, status]
const rows: [string, string, string | null, string | null, string][] = [
  // Today — a mix of present / late / still-in / remote / absent
  ["daniel.reyes@company.com", today, at(today, "08:52"), null, "Present"],
  ["priya.nair@company.com", today, at(today, "09:31"), null, "Late"],
  ["marcus.lee@company.com", today, at(today, "08:45"), at(today, "17:05"), "Present"],
  ["lin.wei@company.com", today, at(today, "08:58"), null, "Remote"],
  ["sofia.rossi@company.com", today, null, null, "Absent"],
  // Yesterday — completed days
  ["daniel.reyes@company.com", yesterday, at(yesterday, "08:49"), at(yesterday, "17:02"), "Present"],
  ["priya.nair@company.com", yesterday, at(yesterday, "09:02"), at(yesterday, "16:40"), "Present"],
  ["marcus.lee@company.com", yesterday, at(yesterday, "09:20"), at(yesterday, "17:30"), "Late"],
];

async function main() {
  console.log("Seeding attendance…");
  await prisma.attendanceRecord.deleteMany();

  const employees = await prisma.employee.findMany({ select: { id: true, email: true } });
  const idByEmail = new Map(employees.map((e) => [e.email, e.id]));

  let created = 0;
  for (const [email, date, clockIn, clockOut, status] of rows) {
    const employeeId = idByEmail.get(email);
    if (!employeeId) {
      console.log(`  ! skipped ${email} (no matching employee)`);
      continue;
    }
    await prisma.attendanceRecord.create({
      data: { employeeId, date, clockIn, clockOut, status },
    });
    created++;
  }

  console.log(`Done. ${created} attendance records seeded (today=${today}).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
