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

export default function Sidebar({ user }: { user: SidebarUser }) {
  // usePathname() tells us the current URL, e.g. "/employees",
  // so we can highlight the menu item you're currently on.
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-surface">
      {/* Brand / logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-border">
        <div className="grid place-items-center h-9 w-9 rounded-xl bg-accent shadow-[0_0_20px_-2px_var(--color-accent)]">
          <Users className="h-5 w-5 text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-ink">HR Dashboard</p>
          <p className="text-[11px] text-ink-faint">People operations</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navSections.map((section) => (
          <div key={section.heading}>
            <p className="px-3 mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
              {section.heading}
            </p>
            <ul className="space-y-1">
              {section.items
                // Hide admin-only links from non-Admins.
                .filter((item) => !item.adminOnly || user.role === "Admin")
                .map((item) => {
                // An item is "active" if the current URL matches its href.
                const active = pathname === item.href;
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={[
                        "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                        active
                          ? "bg-accent-soft text-ink font-medium ring-1 ring-accent/40"
                          : "text-ink-muted hover:bg-surface-2 hover:text-ink",
                      ].join(" ")}
                    >
                      <Icon
                        className={[
                          "h-[18px] w-[18px] shrink-0 transition-colors",
                          active ? "text-accent" : "text-ink-faint group-hover:text-ink",
                        ].join(" ")}
                      />
                      <span className="flex-1">{item.label}</span>
                      {item.soon && (
                        <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-faint">
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

      {/* User card at the bottom — now shows the real logged-in user */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-surface-2 transition-colors">
          <div className="grid place-items-center h-9 w-9 rounded-full bg-gradient-to-br from-accent to-chart-2 text-white text-sm font-semibold">
            {initialsOf(user.name)}
          </div>
          <div className="leading-tight min-w-0 flex-1">
            <p className="text-sm font-medium text-ink truncate">{user.name ?? "User"}</p>
            <p className="text-[11px] text-ink-faint truncate">
              {user.role ? `${user.role} · ` : ""}
              {user.email}
            </p>
          </div>
          {/* Sign out — posts to the `logout` server action, which clears the
              session cookie and redirects to /login. A form (not a link) so it
              actually runs server code. */}
          <form action={logout}>
            <button
              type="submit"
              aria-label="Sign out"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface hover:text-ink"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
