"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, LogOut } from "lucide-react";
import { navSections } from "@/lib/nav";
import { logout } from "@/lib/auth-actions";

// The bits of the logged-in user the sidebar needs to display.
type SidebarUser = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
};

// Turn "Ada Admin" into "AA" for the little avatar circle.
function initialsOf(name?: string | null): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

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
    <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-border bg-surface">
      {/* Brand */}
      <div className="flex h-14 items-center px-3">
        <div className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-surface-2 px-2 py-1.5">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]">
            <Users className="h-4 w-4 text-on-accent" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-label-md text-ink">HR Dashboard</p>
            <p className="truncate text-label-sm font-normal text-ink-faint">People operations</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
        {navSections.map((section) => (
          <div key={section.heading}>
            <p className="mb-1 px-2 text-label-sm uppercase tracking-wider text-ink-faint">
              {section.heading}
            </p>
            <ul className="space-y-0.5">
              {section.items
                // Hide admin-only links from non-Admins.
                .filter((item) => !item.adminOnly || user.role === "Admin")
                .map((item) => {
                  // An item is "active" if the current URL matches its href.
                  const active = pathname === item.href;
                  const Icon = item.icon;
                  const badge = badges[item.href] ?? 0;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={[
                          // A 2px left border is always there; it's only
                          // coloured when active, so text never shifts.
                          "group flex items-center gap-2.5 rounded-r-lg border-l-2 px-2 py-1.5 text-label-md transition-colors",
                          active
                            ? "border-accent bg-surface-2 text-ink"
                            : "border-transparent text-ink-muted hover:bg-surface-2 hover:text-ink",
                        ].join(" ")}
                      >
                        <Icon
                          className={[
                            "h-[18px] w-[18px] shrink-0 transition-colors",
                            active ? "text-accent" : "text-ink-faint group-hover:text-ink",
                          ].join(" ")}
                        />
                        <span className="flex-1">{item.label}</span>
                        {badge > 0 && (
                          <span className="tnum rounded-full bg-accent-soft px-1.5 py-0.5 text-label-sm text-accent-hover">
                            {badge}
                          </span>
                        )}
                        {item.soon && (
                          <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-label-sm text-ink-faint">
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
      <div className="p-3">
        <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-2 p-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-label-sm font-semibold text-accent-hover">
            {initialsOf(user.name)}
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-label-md text-ink">{user.name ?? "User"}</p>
            <p className="truncate text-label-sm font-normal text-ink-faint">{user.role ?? user.email}</p>
          </div>
          {/* Sign out — posts to the `logout` server action, which clears the
              session cookie and redirects to /login. A form (not a link) so it
              actually runs server code. */}
          <form action={logout}>
            <button
              type="submit"
              aria-label="Sign out"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface hover:text-ink"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
