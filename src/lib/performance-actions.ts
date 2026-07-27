"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageReviews } from "@/lib/permissions";
import { REVIEW_STATUSES, type ReviewInput } from "@/lib/performance";

// Resolves who is acting: their name (for reviewerName), whether they may
// manage reviews, and their linked employee (for self-service acknowledge).
async function getActor() {
  const session = await auth();
  if (!session?.user) throw new Error("You must be signed in.");
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { employeeId: true },
  });
  return {
    userId: session.user.id,
    name: session.user.name ?? "Unknown",
    canManage: canManageReviews(session.user.role),
    employeeId: me?.employeeId ?? null,
  };
}

async function requireManager() {
  const actor = await getActor();
  if (!actor.canManage) throw new Error("Not authorized to manage reviews.");
  return actor;
}

function validate(data: ReviewInput) {
  if (!data.employeeId) throw new Error("Please choose an employee.");
  if (!data.period.trim()) throw new Error("Please enter a review period.");
  if (!Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5) {
    throw new Error("Rating must be a whole number from 1 to 5.");
  }
}

// CREATE — write a new review (starts as a Draft).
export async function createReview(data: ReviewInput): Promise<void> {
  const actor = await requireManager();
  validate(data);
  await prisma.performanceReview.create({
    data: {
      employeeId: data.employeeId,
      reviewerName: actor.name,
      period: data.period.trim(),
      rating: data.rating,
      strengths: data.strengths.trim() || null,
      goals: data.goals.trim() || null,
      status: "Draft",
    },
  });
  revalidatePath("/performance");
}

// UPDATE — edit a review's content (not its status).
export async function updateReview(id: string, data: ReviewInput): Promise<void> {
  await requireManager();
  validate(data);
  await prisma.performanceReview.update({
    where: { id },
    data: {
      employeeId: data.employeeId,
      period: data.period.trim(),
      rating: data.rating,
      strengths: data.strengths.trim() || null,
      goals: data.goals.trim() || null,
    },
  });
  revalidatePath("/performance");
}

// SUBMIT / UNSUBMIT — managers move a review between Draft and Submitted.
// (Acknowledged is set only by the employee, via acknowledgeReview.)
export async function setReviewStatus(id: string, status: string): Promise<void> {
  await requireManager();
  if (status !== "Draft" && status !== "Submitted") {
    throw new Error("Managers can only set Draft or Submitted.");
  }
  await prisma.performanceReview.update({ where: { id }, data: { status } });
  revalidatePath("/performance");
}

// ACKNOWLEDGE — a self-service employee accepts their own submitted review.
export async function acknowledgeReview(id: string): Promise<void> {
  const actor = await getActor();
  const review = await prisma.performanceReview.findUnique({
    where: { id },
    select: { employeeId: true, status: true },
  });
  if (!review || review.employeeId !== actor.employeeId) {
    throw new Error("You can only acknowledge your own review.");
  }
  if (review.status !== "Submitted") {
    throw new Error("Only a submitted review can be acknowledged.");
  }
  if (!REVIEW_STATUSES.includes("Acknowledged")) return; // safety
  await prisma.performanceReview.update({ where: { id }, data: { status: "Acknowledged" } });
  revalidatePath("/performance");
}

// DELETE — remove a review (managers only).
export async function deleteReview(id: string): Promise<void> {
  await requireManager();
  await prisma.performanceReview.delete({ where: { id } });
  revalidatePath("/performance");
}
