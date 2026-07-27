"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageLeave } from "@/lib/permissions";
import { dayCount, LEAVE_TYPES, LEAVE_STATUSES, type LeaveInput } from "@/lib/leave";

/*
  Figures out WHO is acting and what they may do. We look up the linked
  employee FRESH from the database (not the session token) so authorization
  is always based on the current link, never a stale login.
*/
async function getActor() {
  const session = await auth();
  if (!session?.user) throw new Error("You must be signed in.");
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { employeeId: true },
  });
  return {
    userId: session.user.id,
    canManage: canManageLeave(session.user.role),
    employeeId: me?.employeeId ?? null, // the Employee this login represents
  };
}

// CREATE — file a new leave request.
export async function createLeaveRequest(data: LeaveInput): Promise<void> {
  const actor = await getActor();

  // Decide WHOSE leave this is:
  //  - Managers/HR/Admin may file for any chosen employee.
  //  - Everyone else may only file for THEMSELVES (their linked employee),
  //    regardless of what the browser sent.
  let employeeId: string;
  if (actor.canManage) {
    if (!data.employeeId) throw new Error("Please choose an employee.");
    employeeId = data.employeeId;
  } else {
    if (!actor.employeeId) {
      throw new Error("Your account isn't linked to an employee record yet.");
    }
    employeeId = actor.employeeId; // forced to self — ignore any sent id
  }

  if (!LEAVE_TYPES.includes(data.type as (typeof LEAVE_TYPES)[number])) {
    throw new Error("Please choose a valid leave type.");
  }

  // Validate the date range and compute the number of days on the SERVER
  // (never trust a day count sent from the browser).
  const days = dayCount(data.startDate, data.endDate);
  if (days === 0) {
    throw new Error("Please pick a valid date range (end on or after start).");
  }

  await prisma.leaveRequest.create({
    data: {
      employeeId,
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      days,
      reason: data.reason.trim() || null,
      status: "Pending", // new requests always start Pending
    },
  });
  revalidatePath("/leave");
}

// APPROVE / REJECT — change a request's status. Managers only (self-service
// users can't approve their own time off).
export async function setLeaveStatus(id: string, status: string): Promise<void> {
  const actor = await getActor();
  if (!actor.canManage) throw new Error("Not authorized to approve or reject leave.");
  if (!LEAVE_STATUSES.includes(status as (typeof LEAVE_STATUSES)[number])) {
    throw new Error("Invalid status.");
  }
  await prisma.leaveRequest.update({ where: { id }, data: { status } });
  revalidatePath("/leave");
}

// DELETE — remove a request. Managers may delete any; a self-service user may
// only cancel their OWN request.
export async function deleteLeaveRequest(id: string): Promise<void> {
  const actor = await getActor();

  if (!actor.canManage) {
    const req = await prisma.leaveRequest.findUnique({
      where: { id },
      select: { employeeId: true },
    });
    if (!req || req.employeeId !== actor.employeeId) {
      throw new Error("You can only cancel your own leave requests.");
    }
  }

  await prisma.leaveRequest.delete({ where: { id } });
  revalidatePath("/leave");
}
