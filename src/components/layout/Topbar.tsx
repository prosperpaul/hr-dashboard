import Link from "next/link";
import { Search, Bell, Plus } from "lucide-react";
import MobileNav from "./MobileNav";

type NavUser = { name?: string | null; email?: string | null; role?: string | null };

export default function Topbar({
  canManageEmployees,
  user,
}: {
  // Only Admin/HR get the quick "Add employee" shortcut.
  canManageEmployees: boolean;
  user: NavUser;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur-md md:gap-4 md:px-6">
      {/* Mobile menu button (hidden on desktop, where the sidebar is visible) */}
      <MobileNav user={user} />

      {/* Search box (hidden on the smallest screens to keep the header tidy) */}
      <div className="relative hidden max-w-md flex-1 sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input
          type="text"
          placeholder="Search employees, departments…"
          className="w-full rounded-lg border border-border bg-bg py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/40"
        />
      </div>

      {/* Right-side actions */}
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid h-9 w-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Bell className="h-[18px] w-[18px]" />
          {/* little unread dot */}
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-accent" />
        </button>

        {canManageEmployees && (
          <Link
            href="/employees"
            className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add employee</span>
          </Link>
        )}
      </div>
    </header>
  );
}
