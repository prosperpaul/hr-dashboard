"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageDepartments } from "@/lib/permissions";

/*
  Server actions for the Department table. Every change re-checks on the
  server that the caller is Admin/HR — hiding buttons in the UI isn't enough.
*/

// Safe UI shape. `employeeCount` is filled in by the page, not stored.
export type DepartmentRow = {
  id: string;
  name: string;
  description: string | null;
  employeeCount: number;
};

export type DepartmentInput = {
  name: string;
  description: string;
};

// Throws unless the caller is a logged-in Admin/HR.
async function assertCanManageDepartments(): Promise<void> {
  const session = await auth();
  if (!canManageDepartments(session?.user?.role)) {
    throw new Error("Not authorized to manage departments.");
  }
}

// CREATE — add a new department.
export async function createDepartment(data: DepartmentInput): Promise<void> {
  await assertCanManageDepartments();

  const name = data.name.trim();
  if (!name) throw new Error("Department name is required.");

  try {
    await prisma.department.create({
      data: { name, description: data.description.trim() || null },
    });
    revalidatePath("/departments");
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error("A department with that name already exists.");
    }
    throw err;
  }
}

// UPDATE — rename a department or change its description.
export async function updateDepartment(id: string, data: DepartmentInput): Promise<void> {
  await assertCanManageDepartments();

  const name = data.name.trim();
  if (!name) throw new Error("Department name is required.");

  try {
    await prisma.department.update({
      where: { id },
      data: { name, description: data.description.trim() || null },
    });
    revalidatePath("/departments");
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new Error("A department with that name already exists.");
    }
    throw err;
  }
}

// DELETE — remove a department.
export async function deleteDepartment(id: string): Promise<void> {
  await assertCanManageDepartments();
  await prisma.department.delete({ where: { id } });
  revalidatePath("/departments");
}
