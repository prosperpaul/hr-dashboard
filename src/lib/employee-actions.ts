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

/*
  BULK actions for the selection bar on the Employees page.
  Each one checks permission ONCE, validates the input, and changes every
  selected employee in a single database statement — so a bulk change either
  fully happens or fails as a whole (no half-updated lists).
*/
function cleanIds(ids: string[]): string[] {
  const unique = [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))];
  if (unique.length === 0) throw new Error("No employees selected.");
  if (unique.length > 500) throw new Error("Please select 500 or fewer employees at a time.");
  return unique;
}

function revalidateEmployeePages() {
  revalidatePath("/employees");
  revalidatePath("/departments");
  revalidatePath("/", "layout"); // overview stats + notifications
}

// Move everyone selected into one department (null = unassigned).
export async function bulkSetDepartment(ids: string[], departmentId: string | null): Promise<number> {
  await assertCanManageEmployees();
  const list = cleanIds(ids);
  if (departmentId) {
    const exists = await prisma.department.findUnique({ where: { id: departmentId }, select: { id: true } });
    if (!exists) throw new Error("That department no longer exists.");
  }
  const { count } = await prisma.employee.updateMany({ where: { id: { in: list } }, data: { departmentId } });
  revalidateEmployeePages();
  return count;
}

// Set the same status (Active / On Leave / Remote) for everyone selected.
export async function bulkSetStatus(ids: string[], status: EmployeeStatus): Promise<number> {
  await assertCanManageEmployees();
  const list = cleanIds(ids);
  if (!["Active", "On Leave", "Remote"].includes(status)) throw new Error("Invalid status.");
  const { count } = await prisma.employee.updateMany({ where: { id: { in: list } }, data: { status } });
  revalidateEmployeePages();
  return count;
}

// Delete everyone selected (their leave, attendance, reviews and payslips go
// with them via the database's cascade rules; linked logins are kept but unlinked).
export async function bulkDeleteEmployees(ids: string[]): Promise<number> {
  await assertCanManageEmployees();
  const list = cleanIds(ids);
  const { count } = await prisma.employee.deleteMany({ where: { id: { in: list } } });
  revalidateEmployeePages();
  return count;
}
