"use client";

import { CheckCircle2 } from "lucide-react";

/*
  LiveMessage — a small "toast" for success messages ("Saved", "Request
  sent"). It sits in an aria-live region, so screen readers read it out the
  moment it appears, without moving the user's focus.

  On phones it floats just above the tab bar; on desktop, bottom-right.
  Render it always, and pass `message` (empty string = nothing shown), so
  the live region already exists when the text arrives.
*/
export default function LiveMessage({ message }: { message: string }) {
  return (
    <div
      aria-live="polite"
      role="status"
      className="pointer-events-none fixed inset-x-gutter bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom)+0.75rem)] z-50 flex justify-center lg:inset-x-auto lg:bottom-6 lg:right-6"
    >
      {message && (
        <p className="pointer-events-auto flex max-w-full animate-[fade-in_180ms_ease-out] items-center gap-2 rounded-full bg-navy px-4 py-3 text-body-md text-on-navy shadow-modal">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" aria-hidden />
          {message}
        </p>
      )}
    </div>
  );
}
