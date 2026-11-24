import { Award } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageReviews } from "@/lib/permissions";
import type { ReviewRow } from "@/lib/performance";
import PerformanceManager from "@/components/performance/PerformanceManager";
import MyReviews from "@/components/performance/MyReviews";
import EmptyState from "@/components/ui/EmptyState";

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
      prisma.employee.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, role: true, department: { select: { name: true } } },
      }),
    ]);
    return (
      <PerformanceManager
        reviews={records.map(toRow)}
        employees={employees.map((e) => ({ id: e.id, name: e.name, role: e.role, department: e.department?.name ?? null }))}
      />
    );
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
  updatedAt: Date;
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
    updatedAt: r.updatedAt.toISOString(),
  };
}

function NotLinked() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-eyebrow uppercase text-ink-muted">Performance · My reviews</p>
        <h1 className="text-headline-lg text-ink md:text-headline-xl">Your reviews will live here.</h1>
      </div>
      <div className="rounded-xl border border-border bg-surface">
        <EmptyState
          icon={Award}
          title="Your account isn't linked yet"
          description="Ask an administrator to link your login to your employee record, then your performance reviews will appear here."
        />
      </div>
    </div>
  );
}
