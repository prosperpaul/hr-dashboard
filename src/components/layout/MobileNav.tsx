"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, LogOut, Menu, X } from "lucide-react";
import { navSections } from "@/lib/nav";
import { logout } from "@/lib/auth-actions";

type NavUser = { name?: string | null; email?: string | null; role?: string | null };

function initialsOf(name?: string | null): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("");
}

// The mobile navigation: a hamburger button (shown only below `lg`) that opens
// a slide-in drawer with the same links as the desktop sidebar.
export default function MobileNav({ user }: { user: NavUser }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // We render the drawer through a portal on document.body so it isn't trapped
  // inside the top bar's backdrop-blur (which would break `position: fixed`).
  // It only renders after a tap (open = true), which never happens on the
  // server, so document.body always exists by then. Every link closes the
  // drawer in its onClick, so navigating closes it too.

  // Close on Escape, and lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Hamburger — only on small screens */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-bg/80 backdrop-blur-md" onClick={() => setOpen(false)} />

          {/* Drawer */}
          <div className="absolute left-0 top-0 flex h-full w-72 max-w-[82%] flex-col border-r border-border-strong bg-surface shadow-modal">
            {/* Brand + close */}
            <div className="flex h-14 items-center justify-between border-b border-border px-4">
              <div className="flex items-center gap-3">
                <div className="grid h-7 w-7 place-items-center rounded-md bg-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]">
                  <Users className="h-4 w-4 text-on-accent" />
                </div>
                <div className="leading-tight">
                  <p className="text-label-md text-ink">HR Dashboard</p>
                  <p className="text-label-sm font-normal text-ink-faint">People operations</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="grid h-8 w-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Nav links */}
            <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3">
              {navSections.map((section) => (
                <div key={section.heading}>
                  <p className="mb-1 px-2 text-label-sm uppercase tracking-wider text-ink-faint">
                    {section.heading}
                  </p>
                  <ul className="space-y-0.5">
                    {section.items
                      .filter((item) => !item.adminOnly || user.role === "Admin")
                      .map((item) => {
                        const active = pathname === item.href;
                        const Icon = item.icon;
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={() => setOpen(false)}
                              className={[
                                "group flex items-center gap-2.5 rounded-r-lg border-l-2 px-2 py-2.5 text-label-md transition-colors",
                                active
                                  ? "border-accent bg-surface-2 text-ink"
                                  : "border-transparent text-ink-muted hover:bg-surface-2 hover:text-ink",
                              ].join(" ")}
                            >
                              <Icon
                                className={[
                                  "h-[18px] w-[18px] shrink-0",
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

            {/* User + sign out */}
            <div className="border-t border-border p-3">
              <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-2 p-2">
                <div className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-label-sm font-semibold text-accent-hover">
                  {initialsOf(user.name)}
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-label-md text-ink">{user.name ?? "User"}</p>
                  <p className="truncate text-label-sm font-normal text-ink-faint">{user.role ?? user.email}</p>
                </div>
                <form action={logout}>
                  <button
                    type="submit"
                    aria-label="Sign out"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
