import Link from "next/link";
import Form from "next/form";
import { Search, Plus, Network } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "./NotificationBell";
import type { Notification } from "@/lib/notifications";
import { initialsOf } from "@/lib/initials";

type NavUser = { name?: string | null; email?: string | null; role?: string | null };

/*
  The top bar.
  • Phones/tablets (below lg), per the mobile design system: a navy band with
    the yellow brand tile, then search, the bell and your avatar (navigation
    lives in the bottom tab bar; the theme switch is in its "More" sheet).
    Every button is at least 48px (size-tap) so it's easy to hit with a thumb.
  • Desktop: white bar, search box on the left, theme / bell / "Add employee"
    / avatar on the right.
*/
export default function Topbar({
  canManageEmployees,
  user,
  notifications,
  now,
}: {
  // Only Admin/HR get the quick "Add employee" shortcut.
  canManageEmployees: boolean;
  user: NavUser;
  notifications: Notification[];
  now: string; // ISO time from the server, for "2h ago" labels
}) {
  return (
    <header className="sticky top-0 z-30 flex h-topbar min-w-0 items-center gap-1 bg-navy px-gutter text-on-navy md:px-8 lg:gap-2 lg:border-b lg:border-border lg:bg-surface/95 lg:text-ink lg:backdrop-blur">
      {/* Brand (phones/tablets only — the sidebar carries it on desktop) */}
      <Link href="/" className="flex min-h-tap min-w-0 items-center gap-2 lg:hidden" aria-label="HR Dashboard home">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-on-accent">
          <Network className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <span className="font-display truncate text-headline-sm text-on-navy">HR Dashboard</span>
      </Link>

      {/* Search box (desktop). A real form: pressing Enter goes to
          /employees?q=<text>, where the directory opens already filtered.
          next/form makes that a fast in-app navigation (no full reload). */}
      <Form action="/employees" role="search" className="relative hidden w-72 lg:block">
        <label htmlFor="global-search" className="sr-only">
          Search people by name, role, email or team
        </label>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
        <input
          id="global-search"
          name="q"
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          placeholder="Search people, teams…  ↵"
          className="h-10 w-full rounded-full border border-border bg-bg pl-9 pr-4 text-body-md text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-ink focus:ring-1 focus:ring-ink"
        />
      </Form>

      {/* Right-side actions */}
      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        {/* Phones/tablets: opens the People directory with its search box focused */}
        <Link
          href="/employees?search=1"
          aria-label="Search people"
          className="grid size-tap place-items-center rounded-full text-on-navy transition-colors hover:bg-navy-2 lg:hidden"
        >
          <Search className="h-5 w-5" aria-hidden />
        </Link>
        <ThemeToggle className="hidden size-10 lg:grid" />
        <NotificationBell items={notifications} now={now} />

        {canManageEmployees && (
          <Link
            href="/employees"
            aria-label="Add employee"
            className="hidden h-10 items-center justify-center gap-1.5 rounded-full bg-accent px-5 text-label-md font-semibold text-on-accent transition-colors hover:bg-accent-hover active:bg-accent-pressed lg:flex"
          >
            <Plus className="h-4 w-4" aria-hidden />
            <span>Add employee</span>
          </Link>
        )}

        <Link
          href="/settings"
          aria-label="Your account"
          className="grid size-tap place-items-center rounded-full lg:size-10"
        >
          <span className="grid size-9 place-items-center rounded-full bg-navy text-label-sm font-bold text-on-navy ring-1 ring-on-navy/40 transition-opacity hover:opacity-85 lg:ring-0">
            {initialsOf(user.name)}
          </span>
        </Link>
      </div>
    </header>
  );
}
