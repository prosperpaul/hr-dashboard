import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { employees } from "../src/lib/sample-data";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding employees…");

  // Start clean so re-running the seed doesn't create duplicates.
  await prisma.employee.deleteMany();

  // Insert each sample employee (we let the DB generate the id). We link the
  // department by NAME via connectOrCreate: connect to the existing department,
  // or create it if it's somehow missing (so this seed works on its own).
  for (const e of employees) {
    await prisma.employee.create({
      data: {
        name: e.name,
        email: e.email,
        role: e.role,
        status: e.status,
        startedAt: e.startedAt,
        department: {
          connectOrCreate: {
            where: { name: e.department },
            create: { name: e.department },
          },
        },
      },
    });
  }

  const count = await prisma.employee.count();
  console.log(`Done. ${count} employees are now in the database.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
