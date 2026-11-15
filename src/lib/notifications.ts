import { prisma } from "@/lib/prisma";
import { canManageLeave, canManageReviews, canManagePayroll, canManageRecruitment } from "@/lib/permissions";
import { periodLabel } from "@/lib/payroll";

/*
  Notifications, built from data that already exists — no notifications
  table yet. Two kinds:

   • "action"  — things waiting on YOU (pending leave to approve, draft pay
                 runs…). They stay until the underlying thing is handled.
   • "update"  — things that happened TO you recently (your leave was
                 approved, a review was shared with you…).

  Which ones you get depends on your role (managers) and on whether your
  login is linked to an employee record (self-service updates).
  Server-only: it talks to the database, so only server code may import it.
*/

export type NotificationKind = "leave" | "review" | "payroll" | "recruitment";
export type Notification = {
  id: string; // stable, so "already seen" can be remembered
  kind: NotificationKind;
  type: "action" | "update";
  title: string;
  detail: string;
  href: string;
  at: string; // ISO time it happened / was last updated
};

const DAY = 86_400_000;

// Short date like "Nov 18" from "YYYY-MM-DD".
const shortDay = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const latest = (dates: Date[]) => new Date(Math.max(0, ...dates.map((d) => d.getTime()))).toISOString();

export async function getNotifications(
  user: { id: string; role?: string | null },
): Promise<{ items: Notification[]; pendingLeave: number }> {
  const role = user.role;
  const since14 = new Date(Date.now() - 14 * DAY);
  const since30 = new Date(Date.now() - 30 * DAY);
  const since7 = new Date(Date.now() - 7 * DAY);
  const none = Promise.resolve(null);

  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { employeeId: true } });
  const empId = me?.employeeId ?? null;

  // Every query runs in parallel; ones this user doesn't need resolve to null.
  const [pendingLeave, draftReviews, draftRuns, offers, newApplicants, myDecided, mySharedReviews, myPayslip] = await Promise.all([
    canManageLeave(role)
      ? prisma.leaveRequest.findMany({
          where: { status: "Pending" },
          orderBy: { createdAt: "desc" },
          select: { id: true, type: true, startDate: true, endDate: true, createdAt: true, employee: { select: { name: true } } },
        })
      : none,
    canManageReviews(role) ? prisma.performanceReview.findMany({ where: { status: "Draft" }, select: { updatedAt: true } }) : none,
    canManagePayroll(role) ? prisma.payRun.findMany({ where: { status: "Draft" }, select: { id: true, period: true, updatedAt: true } }) : none,
    canManageRecruitment(role) ? prisma.candidate.findMany({ where: { stage: "Offer" }, select: { updatedAt: true } }) : none,
    canManageRecruitment(role) ? prisma.candidate.findMany({ where: { createdAt: { gte: since7 } }, select: { createdAt: true } }) : none,
    empId
      ? prisma.leaveRequest.findMany({
          where: { employeeId: empId, status: { in: ["Approved", "Rejected"] }, updatedAt: { gte: since14 } },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: { id: true, type: true, status: true, startDate: true, endDate: true, updatedAt: true },
        })
      : none,
    empId
      ? prisma.performanceReview.findMany({
          where: { employeeId: empId, status: "Submitted" },
          select: { id: true, period: true, reviewerName: true, updatedAt: true },
        })
      : none,
    empId
      ? prisma.payslip.findFirst({
          where: { employeeId: empId, payRun: { status: "Finalized", updatedAt: { gte: since30 } } },
          orderBy: { createdAt: "desc" },
          select: { id: true, payRun: { select: { period: true, updatedAt: true } } },
        })
      : none,
  ]);

  const items: Notification[] = [];

  // ── Things waiting on you ──────────────────────────────────────────
  // Show the 3 newest leave requests individually, the rest as a summary.
  if (pendingLeave?.length) {
    for (const r of pendingLeave.slice(0, 3)) {
      items.push({
        id: `leave-pending-${r.id}`,
        kind: "leave",
        type: "action",
        title: `${r.employee.name} requested ${r.type.toLowerCase()} leave`,
        detail: `${r.startDate === r.endDate ? shortDay(r.startDate) : `${shortDay(r.startDate)} – ${shortDay(r.endDate)}`} · awaiting approval`,
        href: "/leave",
        at: r.createdAt.toISOString(),
      });
    }
    if (pendingLeave.length > 3) {
      items.push({
        id: `leave-pending-more-${pendingLeave.length}`,
        kind: "leave",
        type: "action",
        title: `${plural(pendingLeave.length - 3, "more leave request")} waiting`,
        detail: "Open Leave to review them all",
        href: "/leave",
        at: pendingLeave[3].createdAt.toISOString(),
      });
    }
  }
  if (draftRuns?.length) {
    for (const run of draftRuns) {
      items.push({
        id: `payrun-draft-${run.id}`,
        kind: "payroll",
        type: "action",
        title: `${periodLabel(run.period)} payroll is still a draft`,
        detail: "Finalize it so employees can see their payslips",
        href: "/payroll",
        at: run.updatedAt.toISOString(),
      });
    }
  }
  if (draftReviews?.length) {
    items.push({
      id: `reviews-draft-${draftReviews.length}`,
      kind: "review",
      type: "action",
      title: `${plural(draftReviews.length, "review")} not shared yet`,
      detail: "Drafts are invisible to employees until you share them",
      href: "/performance",
      at: latest(draftReviews.map((r) => r.updatedAt)),
    });
  }
  if (offers?.length) {
    items.push({
      id: `offers-${offers.length}`,
      kind: "recruitment",
      type: "action",
      title: `${plural(offers.length, "offer")} awaiting a decision`,
      detail: "Move candidates to Hired or Rejected when they respond",
      href: "/recruitment",
      at: latest(offers.map((o) => o.updatedAt)),
    });
  }

  // ── Things that happened to you ────────────────────────────────────
  if (newApplicants?.length) {
    items.push({
      id: `applicants-${latest(newApplicants.map((c) => c.createdAt))}`,
      kind: "recruitment",
      type: "update",
      title: `${plural(newApplicants.length, "new applicant")} this week`,
      detail: "See them in the Applied column",
      href: "/recruitment",
      at: latest(newApplicants.map((c) => c.createdAt)),
    });
  }
  for (const r of myDecided ?? []) {
    items.push({
      id: `leave-${r.status.toLowerCase()}-${r.id}`,
      kind: "leave",
      type: "update",
      title: `Your ${r.type.toLowerCase()} leave was ${r.status.toLowerCase()}`,
      detail: r.startDate === r.endDate ? shortDay(r.startDate) : `${shortDay(r.startDate)} – ${shortDay(r.endDate)}`,
      href: "/leave",
      at: r.updatedAt.toISOString(),
    });
  }
  for (const r of mySharedReviews ?? []) {
    items.push({
      id: `review-shared-${r.id}`,
      kind: "review",
      type: "update",
      title: `Your ${r.period} review is ready`,
      detail: `Shared by ${r.reviewerName} · please acknowledge it`,
      href: "/performance",
      at: r.updatedAt.toISOString(),
    });
  }
  if (myPayslip) {
    items.push({
      id: `payslip-${myPayslip.id}`,
      kind: "payroll",
      type: "update",
      title: `Your ${periodLabel(myPayslip.payRun.period)} payslip is ready`,
      detail: "View it on the Payroll page",
      href: "/payroll",
      at: myPayslip.payRun.updatedAt.toISOString(),
    });
  }

  // Actions first, then newest first within each group.
  items.sort((a, b) => (a.type === b.type ? b.at.localeCompare(a.at) : a.type === "action" ? -1 : 1));
  // The pending-leave count also feeds the sidebar badge (no second query).
  return { items, pendingLeave: pendingLeave?.length ?? 0 };
}
