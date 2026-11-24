"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, RotateCw } from "lucide-react";

/*
  A navy strip under the top bar that appears when the device loses its
  internet connection, and disappears by itself when it comes back.

  How it knows: the browser keeps `navigator.onLine` up to date and fires
  "online" / "offline" events when it changes. useSyncExternalStore is
  React's built-in way to read a value that lives OUTSIDE React (here, the
  browser) and re-render whenever it changes.

  On the server there's no navigator, so we assume "online" (the third
  argument) — the banner never flashes on first paint.
*/
function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export default function OfflineBanner() {
  const router = useRouter();
  const online = useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true
  );

  // The live region is always in the page (empty while online), so screen
  // readers announce the message the moment it appears.
  return (
    // Sticks just under the sticky top bar, so it stays visible while scrolling.
    <div aria-live="polite" className="sticky top-topbar z-20">
      {!online && (
        <div className="flex items-center justify-between gap-3 border-t border-navy-line bg-navy px-gutter py-1 text-on-navy md:px-8">
          <p className="flex min-w-0 items-center gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy-2">
              <CloudOff className="h-4 w-4 text-accent" aria-hidden />
            </span>
            <span className="min-w-0 text-label-md">You&apos;re offline. Some info may be out of date.</span>
          </p>
          {/* 48px tall tap area on touch screens; the visible pill stays small. */}
          <button type="button" onClick={() => router.refresh()} className="group flex min-h-tap shrink-0 items-center lg:min-h-9">
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-3.5 text-label-sm font-semibold text-on-accent group-hover:bg-accent-hover">
              <RotateCw className="h-3.5 w-3.5" aria-hidden />
              Retry
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
