import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/*
  Seeds the Department table. Names match the ones already used on employee
  records (in sample-data), so the live headcount on the Departments page
  lines up with existing employees.
*/
const departments = [
  { name: "Engineering", description: "Builds and maintains the product." },
  { name: "Sales", description: "Wins new customers and grows revenue." },
  { name: "Support", description: "Helps customers succeed day to day." },
  { name: "Marketing", description: "Tells our story and drives demand." },
  { name: "Finance", description: "Manages budgets, payroll, and reporting." },
  { name: "Design", description: "Owns product and brand experience." },
  { name: "People", description: "Recruiting, HR, and employee experience." },
];

async function main() {
  console.log("Seeding departments…");

  for (const d of departments) {
    // upsert = safe to re-run (update if the name exists, else create).
    await prisma.department.upsert({
      where: { name: d.name },
      update: { description: d.description },
      create: d,
    });
    console.log(`  ✓ ${d.name}`);
  }

  const count = await prisma.department.count();
  console.log(`Done. ${count} departments in the database.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
