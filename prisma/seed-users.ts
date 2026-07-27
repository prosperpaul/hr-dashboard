import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/*
  Seeds the login accounts (the `User` table).

  HR data is sensitive, so accounts are created BY an admin — there is no
  public sign-up. This script gives us starter accounts to log in with,
  one per role, so we can test role-based access.

  Passwords are hashed with bcrypt before storing. We NEVER save the raw
  password — even we can't read it back, we can only verify a guess.
*/

// The demo password for every seeded account (change before real use!).
const DEMO_PASSWORD = "password123";

const users = [
  { name: "Ada Admin", email: "admin@hrdashboard.com", role: "Admin" },
  { name: "Hana HR", email: "hr@hrdashboard.com", role: "HR" },
  { name: "Max Manager", email: "manager@hrdashboard.com", role: "Manager" },
  { name: "Evan Employee", email: "employee@hrdashboard.com", role: "Employee" },
];

async function main() {
  console.log("Seeding login accounts…");

  // bcrypt.hash(raw, saltRounds) — 10 rounds is a good default.
  // Same password for all demo accounts; each still gets its own hash.
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const u of users) {
    // upsert = update if the email already exists, otherwise create.
    // This makes the script safe to re-run without creating duplicates.
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, passwordHash },
      create: { name: u.name, email: u.email, role: u.role, passwordHash },
    });
    console.log(`  ✓ ${u.role.padEnd(8)} ${u.email}`);
  }

  console.log(`\nDone. Log in with any email above + password: ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
