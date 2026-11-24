import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { resetDemoData } from "../src/lib/demo-seed";

/*
  Rebuild ALL demo sample data in one go (the same thing the nightly reset
  job does). Run with:   pnpm exec tsx prisma/seed-demo.ts

  ⚠ Wipes employees, leave, attendance, reviews, recruitment and payroll.
  Only run it against a DEMO database.
*/
const prisma = new PrismaClient();

resetDemoData(prisma, process.env.DEMO_PASSWORD || "password123")
  .then((summary) => console.log("Demo data reset:", summary))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
