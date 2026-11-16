"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, LogOut, X, Settings } from "lucide-react";
import { navSections } from "@/lib/nav";
import { logout } from "@/lib/auth-actions";
import ThemeToggle from "@/components/ThemeToggle";

type NavUser = { name?: string | null; email?: string | null; role?: string | null };

const CLOSE_MS = 220; // must match the exit animation length below

function initialsOf(name?: string | null): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

/*
  Mobile navigation (shown below the `lg` breakpoint).

  • The trigger is a custom three-line icon with uneven line lengths.
  • The menu is a drawer that slides in from the left with a soft spring and
    slides back out on close. To animate the exit we keep it mounted for a
    moment in a "closing" state, then remove it.
  • Pages are shown as app-style tiles that cascade in one after another.

  The drawer is rendered through a portal on document.body so it isn't trapped
  inside the top bar's backdrop-blur (which would break `position: fixed`).
  It only renders after a tap, which never happens on the server, so
  document.body always exists by then.
*/
export default function MobileNav({ user, badges = {} }: { user: NavUser; badges?: Record<string, number> }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Play the exit animation, then unmount.
  const close = useCallback(() => {
    setClosing(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, CLOSE_MS);
  }, []);

  // Close on Escape, and lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close]);

  // Clear any pending close timer if the component goes away.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  // Running index so each tile appears a little after the previous one.
  let tileIndex = 0;

  return (
    <>
      {/* Trigger — three uneven lines that stretch on hover */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="group grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border transition-colors hover:bg-bg lg:hidden"
      >
        <span className="flex w-5 flex-col items-start gap-[5px]" aria-hidden>
          <span className="h-[2px] w-5 rounded-full bg-ink transition-all duration-300" />
          <span className="h-[2px] w-3.5 rounded-full bg-ink transition-all duration-300 group-hover:w-5" />
          <span className="h-[2px] w-2.5 rounded-full bg-ink-muted transition-all duration-300 group-hover:w-5" />
        </span>
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop */}
            <div
              className={`absolute inset-0 bg-navy/45 ${
                closing ? "motion-safe:animate-[fade-out_220ms_ease-in_forwards]" : "motion-safe:animate-[fade-in_250ms_ease-out]"
              }`}
              onClick={close}
            />

            {/* Drawer */}
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Main menu"
              className={`absolute inset-y-0 left-0 flex w-[min(88vw,360px)] flex-col overflow-hidden border-r border-border bg-surface shadow-modal ${
                closing
                  ? "motion-safe:animate-[drawer-out_220ms_cubic-bezier(0.4,0,1,1)_forwards]"
                  : "motion-safe:animate-[drawer-in_420ms_cubic-bezier(0.22,1,0.36,1)]"
              }`}
            >
              {/* Brand + close */}
              <div className="relative flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
                <div className="flex items-center gap-2.5">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-accent">
                    <Users className="h-[18px] w-[18px] text-on-accent" />
                  </div>
                  <p className="font-display text-[17px] font-bold tracking-tight text-ink">HR Dashboard</p>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close menu"
                  autoFocus
                  className="grid h-9 w-9 place-items-center rounded-full border border-border text-ink-muted transition-colors hover:bg-bg hover:text-ink"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Profile card + quick actions */}
              <div className="relative mx-4 mt-4 rounded-xl bg-navy p-4 text-on-navy">
                <div className="flex items-center gap-3">
                  <div className="font-display grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent text-[17px] font-bold text-on-accent">
                    {initialsOf(user.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-display truncate text-[17px] font-semibold text-on-navy">{user.name ?? "User"}</p>
                    <p className="flex items-center gap-1.5 truncate text-body-sm text-on-navy-muted">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      {user.role ?? "Member"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Link
                    href="/settings"
                    onClick={close}
                    className="flex flex-col items-center gap-1 rounded-lg border border-navy-line py-2 text-label-sm text-on-navy-muted transition-colors hover:bg-navy-2 hover:text-on-navy"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </Link>
                  <div className="flex flex-col items-center gap-1 rounded-lg border border-navy-line pb-2 text-label-sm text-on-navy-muted">
                    <ThemeToggle className="h-7 w-7 text-on-navy-muted hover:bg-transparent hover:text-on-navy" />
                    <span className="-mt-1">Theme</span>
                  </div>
                  <form action={logout} className="contents">
                    <button
                      type="submit"
                      className="flex flex-col items-center gap-1 rounded-lg border border-navy-line py-2 text-label-sm text-on-navy-muted transition-colors hover:bg-navy-2 hover:text-on-navy"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </form>
                </div>
              </div>

              {/* Navigation tiles */}
              <nav className="relative flex-1 space-y-5 overflow-y-auto px-4 pb-6 pt-5">
                {navSections.map((section) => {
                  const items = section.items.filter((item) => !item.adminOnly || user.role === "Admin");
                  if (items.length === 0) return null;
                  return (
                    <div key={section.heading}>
                      <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">{section.heading}</p>
                      <ul className="grid grid-cols-3 gap-2">
                        {items.map((item) => {
                          const active = pathname === item.href;
                          const Icon = item.icon;
                          const badge = badges[item.href] ?? 0;
                          const delay = 60 + tileIndex++ * 35; // cascade
                          return (
                            <li
                              key={item.href}
                              className="motion-safe:animate-[tile-in_380ms_cubic-bezier(0.22,1,0.36,1)_both]"
                              style={{ animationDelay: `${delay}ms` }}
                            >
                              <Link
                                href={item.href}
                                onClick={close}
                                aria-current={active ? "page" : undefined}
                                className={[
                                  "relative flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border p-2 text-center transition-colors active:scale-95",
                                  active
                                    ? "border-accent bg-accent"
                                    : "border-border bg-surface hover:bg-bg",
                                ].join(" ")}
                              >
                                <span
                                  className={`grid h-9 w-9 place-items-center rounded-full ${
                                    active ? "bg-navy text-on-navy" : "bg-bg text-ink"
                                  }`}
                                >
                                  <Icon className="h-[18px] w-[18px]" />
                                </span>
                                <span className={`text-label-sm leading-tight ${active ? "text-on-accent" : "text-ink-muted"}`}>{item.label}</span>
                                {badge > 0 && (
                                  <span className="tnum absolute right-1.5 top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-navy px-1 text-[10px] font-semibold text-on-navy">
                                    {badge}
                                  </span>
                                )}
                                {item.soon && <span className="absolute right-1.5 top-1.5 rounded-full bg-bg px-1.5 text-[9px] text-ink-faint">Soon</span>}
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </nav>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
