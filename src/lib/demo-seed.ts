import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { employees as sampleEmployees } from "./sample-data";
import { todayISO } from "./attendance";
import { computePayslip } from "./payroll";
import { DEMO_ACCOUNTS } from "./demo";

/*
  Rebuilds the demo's sample data. Used by:
   • the nightly reset job  (src/app/api/cron/reset-demo/route.ts)
   • a manual command       (pnpm exec tsx prisma/seed-demo.ts)

  Every date is RELATIVE TO TODAY (Lagos time), so whenever someone visits,
  the demo looks alive: someone is on leave today, there are requests waiting
  for next week, a full week of attendance, this month's payroll in draft…

  It wipes all HR data (employees, leave, attendance, reviews, recruitment,
  payroll) and re-creates it. Login accounts other than the four demo
  accounts are left alone (their employee link is cleared when employees are
  re-created).

  Randomness uses a tiny seeded generator keyed to the date, so the same day
  always produces the same data (easy to reason about, no surprises).
*/

const DAY = 86_400_000;
const LAGOS_OFFSET = "+01:00"; // West Africa Time (no daylight saving)

// ── Date helpers on "YYYY-MM-DD" strings (pure calendar math in UTC) ─────
const toUTC = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
const fromUTC = (t: number) => new Date(t).toISOString().slice(0, 10);
const addDays = (s: string, n: number) => fromUTC(toUTC(s) + n * DAY);
const weekday = (s: string) => new Date(toUTC(s)).getUTCDay(); // 0 = Sun
const inclusiveDays = (a: string, b: string) => Math.round((toUTC(b) - toUTC(a)) / DAY) + 1;
// A Lagos wall-clock time on a given day, as a proper ISO timestamp.
const lagosTime = (day: string, minutes: number) =>
  `${day}T${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00${LAGOS_OFFSET}`;
// A Date `daysAgo` days before now (for createdAt / updatedAt).
const ago = (daysAgo: number, hours = 0) => new Date(Date.now() - daysAgo * DAY - hours * 3_600_000);

// Small deterministic random generator (mulberry32).
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── The sample company ────────────────────────────────────────────────
const DEPARTMENTS = [
  { name: "Engineering", description: "Builds and maintains the product." },
  { name: "Sales", description: "Wins new customers and grows revenue." },
  { name: "Support", description: "Helps customers succeed day to day." },
  { name: "Marketing", description: "Tells our story and drives demand." },
  { name: "Finance", description: "Manages budgets, payroll, and reporting." },
  { name: "Design", description: "Owns product and brand experience." },
  { name: "People", description: "Recruiting, HR, and employee experience." },
];

// Annual salaries in Naira (₦).
const SALARIES: Record<string, number> = {
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

// Newer hires spread over the past year, so the headcount curve rises.
// [name, email, role, department, daysAgo, annual salary ₦]
const RECENT_HIRES: [string, string, string, string, number, number][] = [
  ["Noah Fisher", "noah.fisher@company.com", "Backend Engineer", "Engineering", 5, 11_800_000],
  ["Lucia Moreno", "lucia.moreno@company.com", "Account Executive", "Sales", 18, 9_200_000],
  ["Omar Haddad", "omar.haddad@company.com", "Product Designer", "Design", 72, 10_400_000],
  ["Chidi Nwosu", "chidi.nwosu@company.com", "Support Lead", "Support", 130, 8_400_000],
  ["Zainab Yusuf", "zainab.yusuf@company.com", "Payroll Officer", "Finance", 190, 7_900_000],
  ["Ivy Chen", "ivy.chen@company.com", "Growth Marketer", "Marketing", 250, 9_900_000],
];

// Which employee each demo login represents (Admin is a pure admin login).
const DEMO_LINKS: Record<string, string | null> = {
  "admin@hrdashboard.com": null,
  "hr@hrdashboard.com": "fatima.hassan@company.com",
  "manager@hrdashboard.com": "james.carter@company.com",
  "employee@hrdashboard.com": "amara.okafor@company.com",
};

export async function resetDemoData(prisma: PrismaClient, demoPassword: string) {
  const today = todayISO();
  const random = rng(toUTC(today) / DAY);
  const pick = <T,>(arr: T[]) => arr[Math.floor(random() * arr.length)];

  // 1. Wipe HR data (children first; cascades would also handle most of it).
  await prisma.payslip.deleteMany();
  await prisma.payRun.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.job.deleteMany();
  await prisma.performanceReview.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.employee.deleteMany();

  // 2. Departments: restore the standard set, remove any visitor-made ones.
  for (const d of DEPARTMENTS) {
    await prisma.department.upsert({ where: { name: d.name }, update: { description: d.description }, create: d });
  }
  await prisma.department.deleteMany({ where: { name: { notIn: DEPARTMENTS.map((d) => d.name) } } });
  const deptIdByName = new Map((await prisma.department.findMany({ select: { id: true, name: true } })).map((d) => [d.name, d.id]));

  // 3. Employees.
  await prisma.employee.createMany({
    data: [
      ...sampleEmployees.map((e) => ({
        name: e.name,
        email: e.email,
        role: e.role,
        status: e.status,
        startedAt: e.startedAt,
        salary: SALARIES[e.email] ?? 0,
        departmentId: deptIdByName.get(e.department) ?? null,
      })),
      ...RECENT_HIRES.map(([name, email, role, dept, daysAgo, salary]) => ({
        name,
        email,
        role,
        status: "Active",
        startedAt: addDays(today, -daysAgo),
        salary,
        departmentId: deptIdByName.get(dept) ?? null,
      })),
    ],
  });
  const people = await prisma.employee.findMany({ select: { id: true, email: true, startedAt: true, status: true, salary: true } });
  const id = (email: string) => people.find((p) => p.email === email)!.id;

  // 4. Demo login accounts (password reset, linked to their employee).
  const passwordHash = await bcrypt.hash(demoPassword, 10);
  for (const acc of DEMO_ACCOUNTS) {
    const linkEmail = DEMO_LINKS[acc.email];
    const employeeId = linkEmail ? id(linkEmail) : null;
    await prisma.user.upsert({
      where: { email: acc.email },
      update: { name: acc.name, role: acc.role, passwordHash, employeeId },
      create: { name: acc.name, email: acc.email, role: acc.role, passwordHash, employeeId },
    });
  }

  // 5. Leave — [email, type, startOffset, endOffset, status, reason, submittedDaysAgo]
  const leave: [string, string, number, number, string, string | null, number][] = [
    ["amara.okafor@company.com", "Vacation", -2, 2, "Approved", "Family trip to Calabar", 12],
    ["sofia.rossi@company.com", "Vacation", -5, 4, "Approved", "Annual leave", 20],
    ["diego.martinez@company.com", "Sick", -1, 1, "Approved", "Malaria — doctor's note sent", 2],
    ["daniel.reyes@company.com", "Sick", -18, -17, "Approved", "Flu", 18],
    ["noah.williams@company.com", "Personal", -9, -9, "Approved", "House move", 15],
    ["priya.nair@company.com", "Personal", 6, 6, "Pending", "Visa appointment", 1],
    ["marcus.lee@company.com", "Vacation", 14, 25, "Pending", "Wedding & honeymoon", 2],
    ["lin.wei@company.com", "Sick", 2, 3, "Pending", "Minor surgery", 0],
    ["chloe.bennett@company.com", "Vacation", 9, 13, "Pending", "Christmas travel", 3],
    ["amara.okafor@company.com", "Personal", 21, 21, "Pending", "Graduation ceremony", 1],
    ["hana.kim@company.com", "Vacation", 35, 39, "Approved", null, 6],
    ["ethan.brooks@company.com", "Unpaid", 30, 32, "Rejected", "Extended trip", 4],
  ];
  await prisma.leaveRequest.createMany({
    data: leave.map(([email, type, s, e, status, reason, submitted]) => ({
      employeeId: id(email),
      type,
      startDate: addDays(today, s),
      endDate: addDays(today, e),
      days: inclusiveDays(addDays(today, s), addDays(today, e)),
      status,
      reason,
      createdAt: ago(submitted, 3),
      updatedAt: ago(Math.max(0, submitted - 1), 1),
    })),
  });
  const onLeave = (email: string, day: string) =>
    leave.some(([em, , s, e, st]) => em === email && st === "Approved" && day >= addDays(today, s) && day <= addDays(today, e));

  // 6. Attendance — every weekday in the last two weeks, for everyone employed then.
  const attendance: { employeeId: string; date: string; clockIn: string | null; clockOut: string | null; status: string }[] = [];
  for (let back = 13; back >= 0; back--) {
    const day = addDays(today, -back);
    if (weekday(day) === 0 || weekday(day) === 6) continue; // skip weekends
    const isToday = day === today;
    for (const p of people) {
      if (p.startedAt > day || onLeave(p.email, day)) continue;
      // Leave a few people "not checked in yet" today.
      if (isToday && random() < 0.12) continue;
      const r = random();
      const remoteWorker = p.status === "Remote";
      let status: string;
      let inMin: number | null;
      if (r < 0.04) {
        status = "Absent";
        inMin = null;
      } else if (remoteWorker ? r < 0.75 : r < 0.1) {
        status = "Remote";
        inMin = 8 * 60 + 20 + Math.floor(random() * 60);
      } else if (r < (remoteWorker ? 0.82 : 0.2)) {
        status = "Late";
        inMin = 9 * 60 + 16 + Math.floor(random() * 50); // after the 09:15 cut-off
      } else {
        status = "Present";
        inMin = 8 * 60 + 15 + Math.floor(random() * 58); // 08:15–09:12
      }
      const outMin = inMin === null || (isToday && random() < 0.85) ? null : 16 * 60 + 40 + Math.floor(random() * 75);
      attendance.push({
        employeeId: p.id,
        date: day,
        clockIn: inMin === null ? null : lagosTime(day, inMin),
        clockOut: outMin === null ? null : lagosTime(day, outMin),
        status,
      });
    }
  }
  await prisma.attendanceRecord.createMany({ data: attendance });

  // 7. Performance — last cycle fully done, current cycle in progress.
  const [y, m] = today.split("-").map(Number);
  const current = m >= 7 ? `H2 ${y}` : `H1 ${y}`;
  const previous = m >= 7 ? `H1 ${y}` : `H2 ${y - 1}`;
  const strengths = [
    "Strong ownership and dependable delivery.",
    "Great collaborator; lifts the whole team.",
    "Sharp problem-solver under pressure.",
    "Excellent client relationships.",
    "Consistently raises the quality bar.",
  ];
  const goals = [
    "Lead one cross-team project next cycle.",
    "Mentor a newer teammate.",
    "Improve response times on escalations.",
    "Share learnings more widely.",
    "Deepen technical documentation.",
  ];
  const ratingFor = () => [3, 3, 4, 4, 4, 5, 2][Math.floor(random() * 7)];
  const reviews: { employeeId: string; reviewerName: string; period: string; rating: number; status: string; strengths: string; goals: string; updatedAt: Date }[] = [];
  const established = people.filter((p) => p.startedAt <= addDays(today, -180));
  for (const p of established) {
    reviews.push({ employeeId: p.id, reviewerName: pick(["Max Manager", "Hana HR"]), period: previous, rating: ratingFor(), status: "Acknowledged", strengths: pick(strengths), goals: pick(goals), updatedAt: ago(120 + Math.floor(random() * 30)) });
  }
  established.forEach((p, i) => {
    if (i % 4 === 3) return; // ~a quarter not started yet this cycle
    const status = p.email === "amara.okafor@company.com" ? "Submitted" : ["Acknowledged", "Submitted", "Draft"][i % 3];
    reviews.push({ employeeId: p.id, reviewerName: pick(["Max Manager", "Hana HR"]), period: current, rating: ratingFor(), status, strengths: pick(strengths), goals: pick(goals), updatedAt: ago(Math.floor(random() * 10)) });
  });
  await prisma.performanceReview.createMany({ data: reviews });

  // 8. Recruitment — roles with candidates at every stage.
  const jobs: { title: string; dept: string; location: string; type: string; status: string; postedDaysAgo: number; candidates: [string, string, string | null, number][] }[] = [
    {
      title: "Senior Frontend Engineer", dept: "Engineering", location: "Lagos / Remote", type: "Full-time", status: "Open", postedDaysAgo: 24,
      candidates: [
        ["Tolu Adeyemi", "Interview", "Strong React portfolio; system design round next.", 3],
        ["Grace Chen", "Screening", "Recruiter call booked.", 1],
        ["Kunle Bakare", "Applied", null, 0],
        ["Yuki Tanaka", "Offer", "Offer sent — awaiting response.", 2],
        ["Rahul Mehta", "Rejected", "Not enough frontend depth.", 9],
      ],
    },
    {
      title: "Account Executive", dept: "Sales", location: "Abuja", type: "Full-time", status: "Open", postedDaysAgo: 40,
      candidates: [
        ["Bianca Lopez", "Hired", "Starts next month.", 6],
        ["Ade Balogun", "Interview", "Great energy in first call.", 2],
        ["Ngozi Eze", "Applied", null, 1],
      ],
    },
    {
      title: "HR Generalist", dept: "People", location: "Lagos", type: "Full-time", status: "Open", postedDaysAgo: 12,
      candidates: [
        ["Femi Ojo", "Screening", "CIPM certified.", 2],
        ["Halima Sani", "Applied", null, 0],
        ["Esther Okon", "Applied", null, 4],
      ],
    },
    {
      title: "Product Designer (Contract)", dept: "Design", location: "Remote", type: "Contract", status: "On hold", postedDaysAgo: 55,
      candidates: [["Elena Petrova", "Screening", "Portfolio review pending.", 14]],
    },
    {
      title: "Finance Intern", dept: "Finance", location: "Lagos", type: "Internship", status: "Closed", postedDaysAgo: 90,
      candidates: [["David Musa", "Hired", "Joined last quarter.", 60]],
    },
  ];
  for (const j of jobs) {
    await prisma.job.create({
      data: {
        title: j.title,
        location: j.location,
        type: j.type,
        status: j.status,
        departmentId: deptIdByName.get(j.dept) ?? null,
        createdAt: ago(j.postedDaysAgo),
        candidates: {
          create: j.candidates.map(([name, stage, notes, daysAgo]) => ({
            name,
            email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
            stage,
            notes: notes ?? null,
            createdAt: ago(daysAgo + 3, 2),
            updatedAt: ago(daysAgo, 1),
          })),
        },
      },
    });
  }

  // 9. Payroll — last three months finalized, this month still a draft.
  for (let back = 3; back >= 0; back--) {
    const first = new Date(Date.UTC(y, m - 1 - back, 1));
    const period = `${first.getUTCFullYear()}-${String(first.getUTCMonth() + 1).padStart(2, "0")}`;
    const monthEnd = fromUTC(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
    const run = await prisma.payRun.create({
      data: { period, status: back === 0 ? "Draft" : "Finalized", updatedAt: back === 0 ? ago(0, 2) : ago(back * 30 - 28) },
    });
    const paid = people.filter((p) => p.salary > 0 && p.startedAt <= monthEnd);
    await prisma.payslip.createMany({
      data: paid.map((p) => ({ payRunId: run.id, employeeId: p.id, ...computePayslip(p.salary) })),
    });
  }

  return {
    today,
    employees: people.length,
    leave: leave.length,
    attendance: attendance.length,
    reviews: reviews.length,
    jobs: jobs.length,
  };
}
