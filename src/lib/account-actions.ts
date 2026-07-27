"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// Returns the current user's id, or throws if not signed in.
async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("You must be signed in.");
  return session.user.id;
}

// Update the signed-in user's own display name.
// (The name shown in the sidebar/greeting refreshes on next sign-in, since it
//  lives in the session token.)
export async function updateMyName(name: string): Promise<void> {
  const id = await requireUserId();
  const trimmed = name.trim();
  if (trimmed.length < 2) throw new Error("Name must be at least 2 characters.");
  await prisma.user.update({ where: { id }, data: { name: trimmed } });
  revalidatePath("/settings");
}

// Change the signed-in user's own password (must confirm the current one).
export async function changeMyPassword(
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const id = await requireUserId();

  const user = await prisma.user.findUnique({ where: { id }, select: { passwordHash: true } });
  if (!user) throw new Error("Account not found.");

  // Verify the current password before allowing a change.
  const ok = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!ok) throw new Error("Your current password is incorrect.");

  if (newPassword.length < 8) throw new Error("New password must be at least 8 characters.");
  if (newPassword === currentPassword) throw new Error("New password must be different.");

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id }, data: { passwordHash } });
}
