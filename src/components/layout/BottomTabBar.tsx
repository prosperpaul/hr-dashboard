"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LogOut, Menu, Mail, Sun, Moon } from "lucide-react";
import { tabItems, visibleSections, isActivePath } from "@/lib/nav";
import { logout } from "@/lib/auth-actions";
import BottomSheet from "@/components/ui/BottomSheet";
import { Segmented } from "@/components/ui/Chips";
import { useTheme, setTheme } from "@/components/ThemeToggle";
import { initialsOf } from "@/lib/initials";

type NavUser = { name?: string | null; email?: string | null; role?: string | null };

/*
  Phone & tablet navigation (hidden from lg up, where the sidebar shows).
  Follows the mobile design system ("Studio People Ops"):

  • A white bar fixed to the bottom with a hairline on top. The most-used
    pages (Home, People, Leave — the items marked `tab` in lib/nav.ts) plus
    "More". The current page gets a butter-yellow pill behind its icon and a
    bold navy label; the others are muted.
  • "More" opens the workspace menu as a bottom sheet: who's signed in, every
    other page as a list row, the Light/Dark switch and Sign out.

  `pb-safe` adds the phone's home-bar strip under the icons so they're never
  covered by it.
*/
export default function BottomTabBar({ user, badges = {} }: { user: NavUser; badges?: Record<string, number> }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  const theme = useTheme();

  const onTab = tabItems.some((t) => isActivePath(pathname, t.href));
  // Everything that isn't already a tab goes into the More sheet.
  const moreItems = visibleSections(user.role).flatMap((s) => s.items.filter((i) => !i.tab));
  const moreBadge = moreItems.reduce((n, i) => n + (badges[i.href] ?? 0), 0);

  return (
    <>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-safe lg:hidden">
        <ul className="mx-auto grid h-tabbar max-w-lg grid-cols-4">
          {tabItems.map((item) => (
            <li key={item.href} className="min-w-0">
              <TabButton
                href={item.href}
                label={item.tabLabel ?? item.label}
                icon={<item.icon className="h-5 w-5" aria-hidden />}
                active={isActivePath(pathname, item.href)}
                badge={badges[item.href] ?? 0}
              />
            </li>
          ))}
          <li className="min-w-0">
            <TabButton
              label="More"
              icon={<Menu className="h-5 w-5" aria-hidden />}
              active={!onTab || moreOpen}
              badge={moreBadge}
              onClick={() => setMoreOpen(true)}
              expanded={moreOpen}
            />
          </li>
        </ul>
      </nav>

      <BottomSheet open={moreOpen} onClose={closeMore} title="Workspace menu">
        {/* Who's signed in */}
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <span className="font-display grid size-14 shrink-0 place-items-center rounded-full bg-navy text-headline-sm text-on-navy">
            {initialsOf(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate text-headline-sm text-ink">{user.name ?? "User"}</p>
              {user.role && (
                <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-label-sm text-ink">{user.role}</span>
              )}
            </div>
            {user.email && (
              <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-body-sm text-ink-muted">
                <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{user.email}</span>
              </p>
            )}
          </div>
        </div>

        {/* Every page that isn't on the tab bar */}
        <ul className="divide-y divide-border">
          {moreItems.map((item) => {
            const active = isActivePath(pathname, item.href);
            const badge = badges[item.href] ?? 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={closeMore}
                  aria-current={active ? "page" : undefined}
                  className="flex min-h-14 items-center gap-4 py-2 transition-colors active:bg-surface-2"
                >
                  <span
                    className={`grid size-11 shrink-0 place-items-center rounded-lg ${active ? "bg-accent text-on-accent" : "bg-sunken text-ink"}`}
                  >
                    <item.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-body-lg text-ink ${active ? "font-semibold" : "font-medium"}`}>
                    {item.label}
                  </span>
                  {active && <span className="text-label-sm text-accent-ink">You&apos;re here</span>}
                  {badge > 0 && (
                    <span className="tnum rounded-full bg-accent-soft px-2.5 py-0.5 text-label-sm text-ink">
                      {badge} pending
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Appearance */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sunken p-4">
          <div className="flex min-w-0 items-center gap-3">
            <Sun className="h-5 w-5 shrink-0 text-ink" aria-hidden />
            <div className="min-w-0">
              <p className="text-label-md text-ink">Appearance</p>
              <p className="text-body-sm text-ink-muted">{theme === "dark" ? "Night edition" : "Editorial paper light"}</p>
            </div>
          </div>
          <Segmented
            label="Theme"
            value={theme}
            onChange={(v) => setTheme(v as "light" | "dark")}
            className="w-auto! bg-surface-2"
            options={[
              { key: "light", label: "Light", icon: <Sun className="h-4 w-4" aria-hidden /> },
              { key: "dark", label: "Dark", icon: <Moon className="h-4 w-4" aria-hidden /> },
            ]}
          />
        </div>

        {/* Sign out */}
        <form action={logout} className="mt-4 pb-safe">
          <button
            type="submit"
            className="flex min-h-tap w-full items-center justify-center gap-2 rounded-full bg-sunken text-label-md font-semibold text-ink transition-colors hover:bg-surface-2"
          >
            <LogOut className="h-4 w-4 text-critical" aria-hidden />
            Sign out{user.name ? ` of ${user.name.split(" ")[0]}'s account` : ""}
          </button>
        </form>
      </BottomSheet>
    </>
  );
}

/* One tab: icon (on a butter pill when active) above a short label. */
function TabButton({
  href,
  label,
  icon,
  active,
  badge,
  onClick,
  expanded,
}: {
  href?: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  badge: number;
  onClick?: () => void;
  expanded?: boolean;
}) {
  const inner = (
    <>
      <span
        className={`relative grid h-8 w-14 place-items-center rounded-full transition-colors ${active ? "bg-accent text-on-accent" : "text-ink-muted"}`}
      >
        {icon}
        {badge > 0 && (
          <span className="tnum absolute -right-0.5 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-navy px-1 text-label-sm leading-none text-on-navy ring-2 ring-surface">
            {badge}
          </span>
        )}
      </span>
      <span className={`truncate text-label-sm ${active ? "font-bold text-ink" : "text-ink-muted"}`}>
        {label}
        {badge > 0 && <span className="sr-only">, {badge} pending</span>}
      </span>
    </>
  );
  const cls = "flex h-full w-full flex-col items-center justify-center gap-1 px-1 outline-offset-[-4px]";

  if (href) {
    return (
      <Link href={href} aria-current={active ? "page" : undefined} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-haspopup="dialog" aria-expanded={expanded} className={cls}>
      {inner}
    </button>
  );
}
