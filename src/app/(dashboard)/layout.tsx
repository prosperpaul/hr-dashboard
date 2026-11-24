import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canManageEmployees } from "@/lib/permissions";
import { getNotifications } from "@/lib/notifications";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import BottomTabBar from "@/components/layout/BottomTabBar";
import DemoBanner from "@/components/layout/DemoBanner";
import OfflineBanner from "@/components/layout/OfflineBanner";
import { isDemoUser } from "@/lib/demo";

/*
  The dashboard "shell": sidebar (desktop) / bottom tab bar (phones) + top bar wrapped around every
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
    // The whole document scrolls (not an inner box), so phone browsers can
    // shrink their address bar as you scroll. min-h-dvh = full *visible*
    // screen height, which (unlike vh) doesn't jump when that bar moves.
    <div className="flex min-h-dvh bg-bg">
      {/* Keyboard users can jump straight past the navigation */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-accent focus:px-4 focus:py-3 focus:text-label-md focus:text-on-accent"
      >
        Skip to content
      </a>
      {/* Desktop sidebar (lg+) — sticky, so it stays put while the page scrolls */}
      <Sidebar user={session.user} badges={{ "/leave": pendingLeave }} />
      {/* min-w-0 lets this column shrink below its content's width, so wide
          things (tables, charts) can't push the page sideways. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {isDemoUser(session.user.email) && <DemoBanner role={session.user.role} />}
        <Topbar
          canManageEmployees={canManageEmployees(session.user.role)}
          user={session.user}
          notifications={items}
          now={new Date().toISOString()}
        />
        {/* Navy "You're offline" strip — only shows when the connection drops */}
        <OfflineBanner />
        {/* pb-tabbar-safe leaves room for the phone tab bar + home bar */}
        <main id="main" className="min-w-0 flex-1 px-gutter py-5 pb-tabbar-safe md:px-8 md:py-6 lg:pb-8">
          <div className="mx-auto w-full min-w-0 max-w-page">{children}</div>
        </main>
      </div>
      {/* Phone/tablet navigation (below lg) */}
      <BottomTabBar user={session.user} badges={{ "/leave": pendingLeave }} />
    </div>
  );
}
