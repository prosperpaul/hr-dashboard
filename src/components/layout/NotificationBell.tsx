"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Bell, CalendarDays, Award, Wallet, UserPlus, CheckCheck } from "lucide-react";
import type { Notification, NotificationKind } from "@/lib/notifications";

const ICONS: Record<NotificationKind, typeof Bell> = {
  leave: CalendarDays,
  review: Award,
  payroll: Wallet,
  recruitment: UserPlus,
};

/*
  "Seen" tracking without a database: we remember (in this browser) the time
  you last opened the bell. Anything newer than that counts as unread.
  useSyncExternalStore reads that saved time and re-renders when it changes
  (including from another tab, via the "storage" event).
*/
const SEEN_KEY = "notifications-seen-at";
const SEEN_EVENT = "notifications-seen";
const subscribe = (cb: () => void) => {
  window.addEventListener("storage", cb);
  window.addEventListener(SEEN_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(SEEN_EVENT, cb);
  };
};
const readSeen = () => {
  try {
    return localStorage.getItem(SEEN_KEY) ?? "";
  } catch {
    return "";
  }
};
function markSeen(at: string) {
  try {
    localStorage.setItem(SEEN_KEY, at);
  } catch {
    /* storage blocked — badge just won't remember */
  }
  window.dispatchEvent(new Event(SEEN_EVENT));
}

export default function NotificationBell({ items, now }: { items: Notification[]; now: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  // On the server nothing has been "seen" yet; the browser fills this in.
  const seenAt = useSyncExternalStore(subscribe, readSeen, () => "");

  const isUnread = (n: Notification) => !seenAt || n.at > seenAt;
  const unread = items.filter(isUnread).length;

  // Close on Escape or a click outside the panel. (Clicking an item closes
  // it too — see the link's onClick below.)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const nowMs = new Date(now).getTime();
  const ago = (iso: string) => {
    const mins = Math.max(1, Math.round((nowMs - new Date(iso).getTime()) / 60000));
    if (mins < 60) return `${mins}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    return `${Math.round(mins / 1440)}d ago`;
  };

  const actions = items.filter((n) => n.type === "action");
  const updates = items.filter((n) => n.type === "update");
  const newest = items.reduce((m, n) => (n.at > m ? n.at : m), "");

  // A titled group of notifications (a plain helper, not a component).
  function renderSection(title: string, list: Notification[]) {
    if (list.length === 0) return null;
    return (
      <div>
        <p className="px-4 pb-1 pt-3 text-eyebrow uppercase text-ink-muted">{title}</p>
        <ul>
          {list.map((n) => {
            const Icon = ICONS[n.kind];
            const fresh = isUnread(n);
            return (
              <li key={n.id}>
                <Link
                  href={n.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-tap gap-3 px-4 py-3 transition-colors hover:bg-surface"
                >
                  <span
                    className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${
                      n.type === "action" ? "border-accent/30 bg-accent-soft text-accent-ink" : "border-border bg-surface text-ink-muted"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-label-md ${fresh ? "text-ink" : "text-ink-muted"}`}>{n.title}</span>
                    <span className="block truncate text-body-sm text-ink-faint">{n.detail}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="tnum text-label-sm text-ink-faint">{ago(n.at)}</span>
                    {fresh && <span className="h-2 w-2 rounded-full bg-accent" aria-label="Unread" />}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        aria-haspopup="true"
        className="relative grid size-tap place-items-center rounded-full text-on-navy transition-colors hover:bg-navy-2 lg:size-10 lg:text-ink-muted lg:hover:bg-surface-2 lg:hover:text-ink"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {/* Count badge only when there's something unread */}
        {unread > 0 && (
          <span className="tnum absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-label-sm leading-none text-on-accent ring-2 ring-navy lg:ring-surface lg:right-0 lg:top-0">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-[calc(var(--spacing-topbar)+0.5rem)] z-50 overflow-hidden rounded-xl border border-border-strong bg-surface-2 shadow-popover sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-headline-sm text-ink">Notifications</h2>
              {unread > 0 && <span className="tnum rounded-full bg-accent-soft px-1.5 text-label-sm text-accent-ink">{unread} new</span>}
            </div>
            {unread > 0 && (
              <button
                onClick={() => markSeen(newest)}
                className="-mr-2 inline-flex min-h-tap items-center gap-1 px-2 text-label-sm text-ink-muted transition-colors hover:text-ink"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[min(70dvh,calc(100dvh-10rem))] overflow-y-auto overscroll-contain pb-2">
            {items.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <span className="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface">
                  <CheckCheck className="h-5 w-5 text-accent-ink" />
                </span>
                <p className="mt-3 text-headline-sm text-ink">You&apos;re all caught up</p>
                <p className="mt-1 text-body-sm text-ink-faint">Nothing needs your attention right now.</p>
              </div>
            ) : (
              <>
                {renderSection("Needs your action", actions)}
                {renderSection("Updates", updates)}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
