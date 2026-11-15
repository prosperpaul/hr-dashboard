import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canManageEmployees } from "@/lib/permissions";
import { getNotifications } from "@/lib/notifications";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";

/*
  The dashboard "shell": sidebar + top bar wrapped around every
  page inside the (dashboard) group. {children} is whatever page
  the user is viewing (Overview, Employees, etc.).

  This is a Server Component, so we can read the session here. proxy.ts
  already blocks logged-out users, but we check again as a safety net
  (the docs recommend checking close to where data is used, never trusting
  a single gate) — and we need the user's details for the sidebar anyway.

  Layouts are NOT re-run when you move between pages, so the notification
  queries below run once per visit (and again after any change that calls
  router.refresh / revalidatePath), not on every click.
*/
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // No valid session? Bounce to login. (Belt-and-suspenders with proxy.ts.)
  if (!session?.user) {
    redirect("/login");
  }

  // Notifications for the bell; the pending-leave count also feeds the
  // sidebar badge next to "Leave".
  const { items, pendingLeave } = await getNotifications(session.user);

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <Sidebar user={session.user} badges={{ "/leave": pendingLeave }} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          canManageEmployees={canManageEmployees(session.user.role)}
          user={session.user}
          notifications={items}
          now={new Date().toISOString()}
        />
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
