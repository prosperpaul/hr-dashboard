import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Local "YYYY-MM-DD" for an offset in days from today.
function dayISO(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Newer hires spread across the last ~9 months so the headcount curve rises
// and "New Hires (30d)" is non-zero. [name, email, role, dept, daysAgo, salary]
const hires: [string, string, string, string, number, number][] = [
  ["Noah Fisher", "noah.fisher@company.com", "Backend Engineer", "Engineering", 5, 118000],
  ["Lucia Moreno", "lucia.moreno@company.com", "Account Executive", "Sales", 18, 92000],
  ["Omar Haddad", "omar.haddad@company.com", "Product Designer", "Design", 72, 104000],
  ["Ivy Chen", "ivy.chen@company.com", "Growth Marketer", "Marketing", 250, 99000],
];

async function main() {
  console.log("Seeding recent hires…");
  let n = 0;
  for (const [name, email, role, dept, daysAgo, salary] of hires) {
    await prisma.employee.upsert({
      where: { email },
      update: { name, role, startedAt: dayISO(-daysAgo), salary },
      create: {
        name,
        email,
        role,
        status: "Active",
        startedAt: dayISO(-daysAgo),
        salary,
        department: { connect: { name: dept } },
      },
    });
    n++;
    console.log(`  ✓ ${name} (${daysAgo}d ago, ${dept})`);
  }
  console.log(`Done. ${n} recent hires upserted.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
