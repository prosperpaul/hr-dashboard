import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// [title, deptName, location, type, status, candidates[]]
const jobs: {
  title: string;
  dept: string;
  location: string;
  type: string;
  status: string;
  candidates: { name: string; email: string; stage: string }[];
}[] = [
  {
    title: "Senior Frontend Engineer",
    dept: "Engineering",
    location: "Remote",
    type: "Full-time",
    status: "Open",
    candidates: [
      { name: "Rahul Mehta", email: "rahul.mehta@example.com", stage: "Interview" },
      { name: "Grace Chen", email: "grace.chen@example.com", stage: "Screening" },
      { name: "Tom Becker", email: "tom.becker@example.com", stage: "Applied" },
      { name: "Yuki Tanaka", email: "yuki.tanaka@example.com", stage: "Offer" },
    ],
  },
  {
    title: "Account Executive",
    dept: "Sales",
    location: "New York, NY",
    type: "Full-time",
    status: "Open",
    candidates: [
      { name: "Bianca Lopez", email: "bianca.lopez@example.com", stage: "Hired" },
      { name: "Sam Whitfield", email: "sam.whitfield@example.com", stage: "Rejected" },
      { name: "Ade Balogun", email: "ade.balogun@example.com", stage: "Applied" },
    ],
  },
  {
    title: "Product Designer (Contract)",
    dept: "Design",
    location: "Remote",
    type: "Contract",
    status: "On hold",
    candidates: [
      { name: "Elena Petrova", email: "elena.petrova@example.com", stage: "Screening" },
    ],
  },
];

async function main() {
  console.log("Seeding recruitment…");
  await prisma.candidate.deleteMany();
  await prisma.job.deleteMany();

  let jobCount = 0;
  let candCount = 0;
  for (const j of jobs) {
    const job = await prisma.job.create({
      data: {
        title: j.title,
        location: j.location,
        type: j.type,
        status: j.status,
        department: { connect: { name: j.dept } },
        candidates: {
          create: j.candidates.map((c) => ({ name: c.name, email: c.email, stage: c.stage })),
        },
      },
    });
    jobCount++;
    candCount += j.candidates.length;
    void job;
  }

  console.log(`Done. ${jobCount} jobs and ${candCount} candidates seeded.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
