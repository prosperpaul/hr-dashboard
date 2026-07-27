import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canManageEmployees } from "@/lib/permissions";
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

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={session.user} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar canManageEmployees={canManageEmployees(session.user.role)} user={session.user} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
