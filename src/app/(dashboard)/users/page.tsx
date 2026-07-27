import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canManageUsers } from "@/lib/permissions";
import UsersManager from "@/components/users/UsersManager";
import type { UserRow } from "@/lib/user-actions";

/*
  The user-management page. Runs on the SERVER.

  Only Admins may see it — anyone else is redirected away. (proxy.ts already
  requires login; this adds the role check for this specific page.)
*/
export default async function UsersPage() {
  const session = await auth();

  if (!canManageUsers(session?.user?.role)) {
    redirect("/"); // not an Admin → send back to the overview
  }

  // Fetch users (with any linked employee's name) and the employee list for
  // the link dropdown, in parallel.
  const [records, employees] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: { employee: { select: { name: true } } },
    }),
    prisma.employee.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  // Map to the safe shape (no password hashes leave the server).
  const users: UserRow[] = records.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    employeeId: u.employeeId,
    employeeName: u.employee?.name ?? null,
    createdAt: u.createdAt.toISOString(),
  }));

  return (
    <UsersManager
      initialUsers={users}
      employees={employees}
      currentUserId={session!.user.id}
    />
  );
}
