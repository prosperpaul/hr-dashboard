import { Award } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageReviews } from "@/lib/permissions";
import type { ReviewRow } from "@/lib/performance";
import PerformanceManager from "@/components/performance/PerformanceManager";
import MyReviews from "@/components/performance/MyReviews";

export default async function PerformancePage() {
  const session = await auth();
  const canManage = canManageReviews(session?.user?.role);

  const me = session?.user
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { employeeId: true },
      })
    : null;
  const myEmployeeId = me?.employeeId ?? null;

  // --- Manager / HR / Admin: manage EVERYONE's reviews ---
  if (canManage) {
    const [records, employees] = await Promise.all([
      prisma.performanceReview.findMany({
        orderBy: { createdAt: "desc" },
        include: { employee: { select: { name: true } } },
      }),
      prisma.employee.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]);
    return <PerformanceManager initialReviews={records.map(toRow)} employees={employees} />;
  }

  // --- Not a manager and not linked ---
  if (!myEmployeeId) return <NotLinked />;

  // --- Self-service: own reviews, but ONLY those shared (not Drafts) ---
  const records = await prisma.performanceReview.findMany({
    where: { employeeId: myEmployeeId, status: { in: ["Submitted", "Acknowledged"] } },
    orderBy: { createdAt: "desc" },
    include: { employee: { select: { name: true } } },
  });
  return <MyReviews initialReviews={records.map(toRow)} />;
}

function toRow(r: {
  id: string;
  employeeId: string;
  employee: { name: string };
  reviewerName: string;
  period: string;
  rating: number;
  strengths: string | null;
  goals: string | null;
  status: string;
}): ReviewRow {
  return {
    id: r.id,
    employeeId: r.employeeId,
    employeeName: r.employee.name,
    reviewerName: r.reviewerName,
    period: r.period,
    rating: r.rating,
    strengths: r.strengths,
    goals: r.goals,
    status: r.status,
  };
}

function NotLinked() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Performance</h1>
      <div className="grid place-items-center rounded-2xl border border-border bg-surface py-16 text-center">
        <div className="max-w-sm">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-surface-2">
            <Award className="h-5 w-5 text-ink-faint" />
          </div>
          <p className="mt-3 text-sm font-medium text-ink">Your account isn&apos;t linked yet</p>
          <p className="mt-1 text-sm text-ink-muted">
            Ask an administrator to link your login to your employee record, then
            your performance reviews will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}
