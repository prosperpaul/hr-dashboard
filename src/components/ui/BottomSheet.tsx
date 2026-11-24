"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/*
  BottomSheet — a panel that slides up from the bottom of a phone screen.
  From the md breakpoint up it turns into a centred dialog instead.

  Accessibility built in:
  • role="dialog" + aria-modal, labelled by its title.
  • Focus moves into the sheet when it opens, Tab/Shift+Tab stay inside it
    (a "focus trap"), and focus returns to the button that opened it.
  • Escape or tapping the dimmed backdrop closes it.
  • The page behind can't scroll while it's open.
  • Animations obey "reduce motion" (see globals.css).

  The parent owns `open`. When it flips to false we keep the sheet on
  screen just long enough to play the slide-down, then remove it.
*/
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function BottomSheet({
  open,
  onClose,
  title,
  eyebrow,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string; // small caps label above the title
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode; // sticky action bar at the bottom (e.g. Apply / Reset)
  size?: "md" | "lg" | "xl"; // width of the desktop dialog
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  // "rendered" stays true during the closing animation. We update it while
  // rendering (React's recommended way to follow a prop) rather than in an effect.
  const [rendered, setRendered] = useState(open);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setRendered(true);
  }
  const closing = rendered && !open;

  // Keep the latest onClose in a ref, so a parent re-render (which creates a
  // new function) doesn't re-run the open/focus logic below.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // While open: lock page scroll, trap focus, listen for Escape.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";

    const panel = panelRef.current;
    // Where focus starts: a field marked data-autofocus (e.g. a form's first
    // input), else the first control in the body, else the Close button.
    const first =
      panel?.querySelector<HTMLElement>("[data-autofocus]") ??
      panel?.querySelector<HTMLElement>(`[data-sheet-body] :is(${FOCUSABLE})`) ??
      panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus({ preventScroll: true }); // don't scroll the sheet to reach it

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      root.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [open]);

  if (!rendered || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      {/* Dimmed backdrop — tap to close */}
      <div
        aria-hidden
        onClick={onClose}
        className={`absolute inset-0 bg-navy/45 ${closing ? "animate-[fade-out_200ms_ease-in_forwards]" : "animate-[fade-in_220ms_ease-out]"}`}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onAnimationEnd={(e) => {
          // Only the panel's own slide-down ends the closing phase.
          if (closing && e.target === e.currentTarget) setRendered(false);
        }}
        className={[
          "relative flex max-h-[90dvh] w-full min-w-0 flex-col overflow-hidden rounded-t-2xl border border-border bg-surface shadow-modal outline-none",
          "md:rounded-xl",
          { md: "md:max-w-lg", lg: "md:max-w-2xl", xl: "md:max-w-4xl" }[size],
          closing
            ? "animate-[sheet-out_200ms_cubic-bezier(0.4,0,1,1)_forwards] md:animate-[fade-out_150ms_ease-in_forwards]"
            : "animate-[sheet-in_320ms_cubic-bezier(0.22,1,0.36,1)] md:animate-[fade-in_180ms_ease-out]",
        ].join(" ")}
      >
        {/* Grab handle (a visual hint on phones only) */}
        <div aria-hidden className="flex justify-center pt-2 md:hidden">
          <span className="h-1 w-10 rounded-full bg-border-strong" />
        </div>

        <header className="flex items-start justify-between gap-3 border-b border-border px-gutter pb-3 pt-2 md:px-6 md:pt-5">
          <div className="min-w-0">
            {eyebrow && <p className="mb-0.5 text-eyebrow uppercase text-accent-ink">{eyebrow}</p>}
            <h2 id={titleId} className="text-headline-sm text-ink">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-body-sm text-ink-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 grid size-tap shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div data-sheet-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-gutter py-4 md:px-6">{children}</div>

        {footer && (
          <div className="flex shrink-0 gap-2 border-t border-border bg-surface px-gutter pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-6 md:pb-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
