"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Network } from "lucide-react";
import { visibleSections, isActivePath } from "@/lib/nav";
import { initialsOf } from "@/lib/initials";
import { logout } from "@/lib/auth-actions";

// The bits of the logged-in user the sidebar needs to display.
type SidebarUser = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

export default function Sidebar({
  user,
  badges = {},
}: {
  user: SidebarUser;
  // Optional counts shown next to a link, keyed by href, e.g. { "/leave": 3 }.
  badges?: Record<string, number>;
}) {
  // usePathname() tells us the current URL, e.g. "/employees",
  // so we can highlight the menu item you're currently on.
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 hidden h-dvh w-sidebar shrink-0 flex-col border-r border-navy-line bg-navy text-on-navy lg:flex">
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-navy-line px-6">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-on-accent">
          <Network className="h-[18px] w-[18px]" />
        </div>
        <span className="font-display truncate text-[18px] font-bold tracking-tight">HR Dashboard</span>
      </div>

      {/* Navigation */}
      <nav aria-label="Main" className="flex-1 space-y-6 overflow-y-auto px-4 py-6 [scrollbar-color:var(--color-navy-line)_transparent]">
        {visibleSections(user.role).map((section) => (
          <div key={section.heading}>
            <p className="mb-1.5 px-3 text-eyebrow uppercase text-on-navy-muted">
              {section.heading}
            </p>
            <ul className="flex flex-col gap-1">
              {section.items.map((item) => {
                  // An item is "active" if the current URL matches its href.
                  const active = isActivePath(pathname, item.href);
                  const Icon = item.icon;
                  const badge = badges[item.href] ?? 0;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={[
                          // Active page = white text + a short butter-yellow
                          // bar on the left edge (drawn with ::before).
                          "relative flex items-center gap-3 rounded px-3 py-2 text-body-md transition-colors",
                          active
                            ? "font-semibold text-on-navy before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded-r before:bg-accent"
                            : "text-on-navy-muted hover:text-on-navy",
                        ].join(" ")}
                      >
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        <span className="flex-1">{item.label}</span>
                        {badge > 0 && (
                          <span className="tnum rounded-full bg-accent px-1.5 py-0.5 text-label-sm text-on-accent">{badge}</span>
                        )}
                        {item.soon && (
                          <span className="rounded-full border border-navy-line px-1.5 py-0.5 text-label-sm text-on-navy-muted">
                            Soon
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Logged-in user + sign out */}
      <div className="border-t border-navy-line p-4">
        <div className="flex items-center gap-2.5 rounded-lg bg-navy-2 px-3 py-2">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-label-sm font-bold text-on-accent">
            {initialsOf(user.name)}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-label-md text-on-navy">{user.name ?? "User"}</p>
            <p className="truncate text-eyebrow uppercase text-on-navy-muted">{user.role ?? user.email}</p>
          </div>
          {/* Sign out — posts to the `logout` server action, which clears the
              session cookie and redirects to /login. A form (not a link) so it
              actually runs server code. */}
          <form action={logout}>
            <button
              type="submit"
              aria-label="Sign out"
              className="grid h-8 w-8 shrink-0 place-items-center rounded text-on-navy-muted transition-colors hover:text-on-navy"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
