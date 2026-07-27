"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageUsers } from "@/lib/permissions";

/*
  Server actions for managing LOGIN ACCOUNTS (the User table).

  Every action re-checks on the server that the caller is an Admin — hiding
  the page in the UI is not enough. We also guard against an Admin locking
  themselves out (deleting or demoting their own account).
*/

// The safe shape we send to the browser — NEVER includes passwordHash.
export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  employeeId: string | null;   // linked Employee record, if any
  employeeName: string | null; // resolved name of that employee
  createdAt: string;
};

// Fields the form submits. `password` is optional on edit (blank = keep current).
// `employeeId` links this login to an Employee record (null/"" = unlinked).
export type UserInput = {
  name: string;
  email: string;
  role: string;
  password?: string;
  employeeId?: string | null;
};

// Convert a DB row (with its optional linked employee) to the safe UI shape.
function toRow(u: {
  id: string;
  name: string;
  email: string;
  role: string;
  employeeId: string | null;
  employee: { name: string } | null;
  createdAt: Date;
}): UserRow {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    employeeId: u.employeeId,
    employeeName: u.employee?.name ?? null,
    createdAt: u.createdAt.toISOString(),
  };
}

// Turn a Prisma unique-constraint (P2002) error into a specific message,
// since the clash could now be the email OR the linked employee.
function uniqueErrorMessage(err: unknown): string | null {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    const target = String(err.meta?.target ?? "");
    if (target.includes("employee")) return "That employee is already linked to another account.";
    return "That email is already in use.";
  }
  return null;
}

// Returns the current Admin's session, or throws if the caller isn't an Admin.
async function requireAdmin() {
  const session = await auth();
  if (!canManageUsers(session?.user?.role)) {
    throw new Error("Not authorized to manage users.");
  }
  return session!;
}

// CREATE — add a new login account.
export async function createUser(data: UserInput): Promise<UserRow> {
  await requireAdmin();

  const password = data.password?.trim();
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const created = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        role: data.role,
        passwordHash,
        employeeId: data.employeeId || null, // "" → null (unlinked)
      },
      include: { employee: { select: { name: true } } },
    });
    revalidatePath("/users");
    return toRow(created);
  } catch (err) {
    const msg = uniqueErrorMessage(err);
    if (msg) throw new Error(msg);
    throw err;
  }
}

// UPDATE — change an account's name/role, and optionally reset the password.
export async function updateUser(id: string, data: UserInput): Promise<UserRow> {
  const session = await requireAdmin();

  // Safety: an Admin can't demote THEMSELVES out of Admin (avoids lock-out).
  if (session.user.id === id && data.role !== "Admin") {
    throw new Error("You can't change your own role away from Admin.");
  }

  // Only include passwordHash in the update if a new password was typed.
  const password = data.password?.trim();
  let passwordHash: string | undefined;
  if (password) {
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }
    passwordHash = await bcrypt.hash(password, 10);
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        role: data.role,
        employeeId: data.employeeId || null, // "" → null (unlinked)
        ...(passwordHash ? { passwordHash } : {}),
      },
      include: { employee: { select: { name: true } } },
    });
    revalidatePath("/users");
    return toRow(updated);
  } catch (err) {
    const msg = uniqueErrorMessage(err);
    if (msg) throw new Error(msg);
    throw err;
  }
}

// DELETE — remove a login account.
export async function deleteUser(id: string): Promise<void> {
  const session = await requireAdmin();

  // Safety: you can't delete your own account while logged in.
  if (session.user.id === id) {
    throw new Error("You can't delete your own account.");
  }

  await prisma.user.delete({ where: { id } });
  revalidatePath("/users");
}
