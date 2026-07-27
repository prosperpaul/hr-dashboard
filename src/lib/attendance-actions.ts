"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageAttendance } from "@/lib/permissions";
import { todayISO, isLate } from "@/lib/attendance";

/*
  Figures out WHO is acting. Like leave, we resolve the linked employee fresh
  from the DB so clock-in/out always applies to the right person.
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
    canManage: canManageAttendance(session.user.role),
    employeeId: me?.employeeId ?? null,
  };
}

// Requires the caller to be linked to an employee, and returns that id.
async function requireLinkedEmployee(): Promise<string> {
  const actor = await getActor();
  if (!actor.employeeId) {
    throw new Error("Your account isn't linked to an employee record yet.");
  }
  return actor.employeeId;
}

// CLOCK IN — record today's start time for the current user (self-service).
export async function clockIn(): Promise<void> {
  const employeeId = await requireLinkedEmployee();
  const date = todayISO();
  const now = new Date().toISOString();

  const existing = await prisma.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId, date } },
  });
  if (existing?.clockIn) {
    throw new Error("You've already clocked in today.");
  }

  // Late if past the threshold; otherwise Present.
  const status = isLate(now) ? "Late" : "Present";

  if (existing) {
    await prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: { clockIn: now, status },
    });
  } else {
    await prisma.attendanceRecord.create({
      data: { employeeId, date, clockIn: now, status },
    });
  }
  revalidatePath("/attendance");
}

// CLOCK OUT — record today's end time for the current user (self-service).
export async function clockOut(): Promise<void> {
  const employeeId = await requireLinkedEmployee();
  const date = todayISO();

  const rec = await prisma.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId, date } },
  });
  if (!rec?.clockIn) throw new Error("You haven't clocked in today.");
  if (rec.clockOut) throw new Error("You've already clocked out today.");

  await prisma.attendanceRecord.update({
    where: { id: rec.id },
    data: { clockOut: new Date().toISOString() },
  });
  revalidatePath("/attendance");
}

// DELETE — remove a record. Managers may delete any; a self-service user may
// only delete their own.
export async function deleteAttendance(id: string): Promise<void> {
  const actor = await getActor();
  if (!actor.canManage) {
    const rec = await prisma.attendanceRecord.findUnique({
      where: { id },
      select: { employeeId: true },
    });
    if (!rec || rec.employeeId !== actor.employeeId) {
      throw new Error("You can only delete your own attendance.");
    }
  }
  await prisma.attendanceRecord.delete({ where: { id } });
  revalidatePath("/attendance");
}
