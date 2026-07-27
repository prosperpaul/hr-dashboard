import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// [email, period, rating, status, strengths, goals]
const rows: [string, string, number, string, string | null, string | null][] = [
  // Amara = employee@'s linked record. A Submitted review she can acknowledge,
  // and a past Acknowledged one. (No Draft for her — drafts stay hidden.)
  ["amara.okafor@company.com", "H1 2026", 4, "Submitted", "Strong ownership of the new dashboard; great collaboration.", "Take the lead on one cross-team project next half."],
  ["amara.okafor@company.com", "H2 2025", 3, "Acknowledged", "Reliable delivery.", "Grow code-review depth."],
  // Others
  ["daniel.reyes@company.com", "H1 2026", 5, "Submitted", "Blew past quota; excellent client relationships.", "Mentor a junior AE."],
  ["priya.nair@company.com", "H1 2026", 4, "Draft", "Sharp research instincts.", "Publish findings more widely."],
  ["marcus.lee@company.com", "H1 2026", 2, "Draft", "Dependable on tickets.", "Improve response times on escalations."],
];

async function main() {
  console.log("Seeding performance reviews…");
  await prisma.performanceReview.deleteMany();

  const employees = await prisma.employee.findMany({ select: { id: true, email: true } });
  const idByEmail = new Map(employees.map((e) => [e.email, e.id]));

  let created = 0;
  for (const [email, period, rating, status, strengths, goals] of rows) {
    const employeeId = idByEmail.get(email);
    if (!employeeId) {
      console.log(`  ! skipped ${email} (no matching employee)`);
      continue;
    }
    await prisma.performanceReview.create({
      data: { employeeId, reviewerName: "Max Manager", period, rating, status, strengths, goals },
    });
    created++;
  }
  console.log(`Done. ${created} reviews seeded.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
