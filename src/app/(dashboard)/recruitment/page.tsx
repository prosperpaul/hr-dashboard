import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageRecruitment } from "@/lib/permissions";
import type { JobRow } from "@/lib/recruitment";
import RecruitmentManager from "@/components/recruitment/RecruitmentManager";

export default async function RecruitmentPage() {
  const session = await auth();

  // Candidate data is sensitive — only Admin/HR/Manager. Others go home.
  if (!canManageRecruitment(session?.user?.role)) {
    redirect("/");
  }

  const [jobRecords, departments] = await Promise.all([
    prisma.job.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        department: { select: { name: true } },
        candidates: { orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const jobs: JobRow[] = jobRecords.map((j) => ({
    id: j.id,
    title: j.title,
    departmentId: j.departmentId,
    department: j.department?.name ?? "—",
    location: j.location,
    type: j.type,
    status: j.status,
    description: j.description,
    candidates: j.candidates.map((c) => ({
      id: c.id,
      jobId: c.jobId,
      name: c.name,
      email: c.email,
      stage: c.stage,
      notes: c.notes,
    })),
  }));

  return <RecruitmentManager jobs={jobs} departments={departments} />;
}
