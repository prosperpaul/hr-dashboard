import Link from "next/link";
import { Search, Plus } from "lucide-react";
import MobileNav from "./MobileNav";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "./NotificationBell";
import type { Notification } from "@/lib/notifications";

type NavUser = { name?: string | null; email?: string | null; role?: string | null };

function initialsOf(name?: string | null): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export default function Topbar({
  canManageEmployees,
  user,
  notifications,
  now,
  badges = {},
}: {
  // Only Admin/HR get the quick "Add employee" shortcut.
  canManageEmployees: boolean;
  user: NavUser;
  notifications: Notification[];
  now: string; // ISO time from the server, for "2h ago" labels
  badges?: Record<string, number>; // e.g. { "/leave": 3 } — shown on mobile menu tiles
}) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-border bg-surface px-4 md:px-8">
      {/* Mobile menu button (hidden on desktop, where the sidebar is visible) */}
      <MobileNav user={user} badges={badges} />

      {/* Search box (hidden on the smallest screens to keep the header tidy) */}
      <div className="relative hidden w-72 sm:block">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input
          type="text"
          placeholder="Search employees, teams…"
          className="h-10 w-full rounded-full border border-border bg-bg pl-9 pr-4 text-body-md text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-ink focus:ring-1 focus:ring-ink"
        />
      </div>

      {/* Right-side actions */}
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <NotificationBell items={notifications} now={now} />

        {canManageEmployees && (
          <Link
            href="/employees"
            className="flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 sm:px-5 text-label-md font-semibold text-on-accent transition-colors hover:bg-accent-hover active:bg-accent-pressed"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add employee</span>
          </Link>
        )}

        <Link
          href="/settings"
          aria-label="Your account"
          className="grid h-9 w-9 place-items-center rounded-full bg-navy text-label-sm font-bold text-on-navy transition-opacity hover:opacity-85"
        >
          {initialsOf(user.name)}
        </Link>
      </div>
    </header>
  );
}
