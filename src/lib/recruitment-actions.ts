"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageRecruitment } from "@/lib/permissions";
import {
  JOB_STATUSES,
  EMPLOYMENT_TYPES,
  CANDIDATE_STAGES,
  type JobInput,
  type CandidateInput,
} from "@/lib/recruitment";

async function assertCanManage(): Promise<void> {
  const session = await auth();
  if (!canManageRecruitment(session?.user?.role)) {
    throw new Error("Not authorized to manage recruitment.");
  }
}

// ---- Jobs ----------------------------------------------------------------

export async function createJob(data: JobInput): Promise<void> {
  await assertCanManage();
  if (!data.title.trim()) throw new Error("Please enter a job title.");
  await prisma.job.create({
    data: {
      title: data.title.trim(),
      departmentId: data.departmentId || null,
      location: data.location.trim() || null,
      type: EMPLOYMENT_TYPES.includes(data.type as (typeof EMPLOYMENT_TYPES)[number]) ? data.type : "Full-time",
      status: JOB_STATUSES.includes(data.status as (typeof JOB_STATUSES)[number]) ? data.status : "Open",
      description: data.description.trim() || null,
    },
  });
  revalidatePath("/recruitment");
}

export async function updateJob(id: string, data: JobInput): Promise<void> {
  await assertCanManage();
  if (!data.title.trim()) throw new Error("Please enter a job title.");
  await prisma.job.update({
    where: { id },
    data: {
      title: data.title.trim(),
      departmentId: data.departmentId || null,
      location: data.location.trim() || null,
      type: data.type,
      status: data.status,
      description: data.description.trim() || null,
    },
  });
  revalidatePath("/recruitment");
}

export async function deleteJob(id: string): Promise<void> {
  await assertCanManage();
  await prisma.job.delete({ where: { id } }); // cascades to its candidates
  revalidatePath("/recruitment");
}

// ---- Candidates ----------------------------------------------------------

export async function createCandidate(data: CandidateInput): Promise<void> {
  await assertCanManage();
  if (!data.jobId) throw new Error("Missing job.");
  if (!data.name.trim()) throw new Error("Please enter the candidate's name.");
  await prisma.candidate.create({
    data: {
      jobId: data.jobId,
      name: data.name.trim(),
      email: data.email.trim() || null,
      stage: CANDIDATE_STAGES.includes(data.stage as (typeof CANDIDATE_STAGES)[number]) ? data.stage : "Applied",
      notes: data.notes.trim() || null,
    },
  });
  revalidatePath("/recruitment");
}

// Move a candidate along the pipeline.
export async function setCandidateStage(id: string, stage: string): Promise<void> {
  await assertCanManage();
  if (!CANDIDATE_STAGES.includes(stage as (typeof CANDIDATE_STAGES)[number])) {
    throw new Error("Invalid stage.");
  }
  await prisma.candidate.update({ where: { id }, data: { stage } });
  revalidatePath("/recruitment");
}

export async function deleteCandidate(id: string): Promise<void> {
  await assertCanManage();
  await prisma.candidate.delete({ where: { id } });
  revalidatePath("/recruitment");
}
