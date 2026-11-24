import AccessDenied from "@/components/ui/AccessDenied";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageRecruitment } from "@/lib/permissions";
import type { JobRow } from "@/lib/recruitment";
import RecruitmentManager from "@/components/recruitment/RecruitmentManager";

export default async function RecruitmentPage() {
  const session = await auth();

  // Candidate data is sensitive — only Admin/HR/Manager. Others see an
  // explanation (returned BEFORE any query runs, so no candidate data loads).
  if (!canManageRecruitment(session?.user?.role)) {
    return (
      <AccessDenied
        role={session?.user?.role}
        required="Admin, HR or Manager"
        audience="Admin, HR and Managers"
        section="Recruitment"
        reason="Candidate details are kept to the people who hire."
      />
    );
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
    createdAt: j.createdAt.toISOString(),
    candidates: j.candidates.map((c) => ({
      id: c.id,
      jobId: c.jobId,
      name: c.name,
      email: c.email,
      stage: c.stage,
      notes: c.notes,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  }));

  // "now" from the server so relative times ("2h ago") match on server & browser.
  return <RecruitmentManager jobs={jobs} departments={departments} now={new Date().toISOString()} />;
}
