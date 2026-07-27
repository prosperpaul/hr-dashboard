"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageEmployees } from "@/lib/permissions";
import type { Employee, EmployeeStatus } from "@/lib/sample-data";

// The fields needed to create/update an employee. Department is chosen by id
// (the foreign key); it may be null for an unassigned employee.
export type EmployeeInput = {
  name: string;
  email: string;
  role: string;
  departmentId: string | null;
  status: EmployeeStatus;
  startedAt: string;
  leaveAllowance: number;
};

/*
  Security gate. Server actions are public endpoints — anyone could call them
  directly, bypassing our UI. So we re-check permission on the server BEFORE
  every change. Hiding a button is UX; THIS is the actual protection.

  Throws if the caller isn't a logged-in Admin/HR. The thrown error surfaces
  to the client as a failed action (our UI already shows a friendly message).
*/
async function assertCanManageEmployees(): Promise<void> {
  const session = await auth();
  if (!canManageEmployees(session?.user?.role)) {
    throw new Error("Not authorized to manage employees.");
  }
}

// A DB row WITH its related department pulled in (via `include`). We convert
// this into the clean shape our components use, resolving the department name.
type EmployeeRecord = {
  id: string;
  name: string;
  email: string;
  role: string;
  departmentId: string | null;
  department: { name: string } | null;
  status: string;
  startedAt: string;
  leaveAllowance: number;
};

function toEmployee(rec: EmployeeRecord): Employee {
  return {
    id: rec.id,
    name: rec.name,
    email: rec.email,
    role: rec.role,
    departmentId: rec.departmentId,
    department: rec.department?.name ?? "Unassigned",
    status: rec.status as EmployeeStatus,
    startedAt: rec.startedAt,
    leaveAllowance: rec.leaveAllowance,
  };
}

// CREATE — add a new employee to the database.
export async function createEmployee(data: EmployeeInput): Promise<Employee> {
  await assertCanManageEmployees();
  const rec = await prisma.employee.create({
    data,
    include: { department: true }, // pull the related dept so we can show its name
  });
  revalidatePath("/employees"); // tell Next.js the page's data changed
  revalidatePath("/departments"); // headcounts may have changed too
  return toEmployee(rec);
}

// UPDATE — change an existing employee.
export async function updateEmployee(id: string, data: EmployeeInput): Promise<Employee> {
  await assertCanManageEmployees();
  const rec = await prisma.employee.update({
    where: { id },
    data,
    include: { department: true },
  });
  revalidatePath("/employees");
  revalidatePath("/departments");
  return toEmployee(rec);
}

// DELETE — remove an employee.
export async function deleteEmployee(id: string): Promise<void> {
  await assertCanManageEmployees();
  await prisma.employee.delete({ where: { id } });
  revalidatePath("/employees");
  revalidatePath("/departments");
}
