"use client";

import { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";

/*
  Light/dark switch.

  The current theme lives on <html data-theme="light|dark"> (set before the
  page paints by the script in app/layout.tsx). This button just flips that
  attribute and remembers the choice in localStorage.

  useSyncExternalStore lets React "subscribe" to that attribute: a
  MutationObserver tells React whenever it changes, so the icon always
  matches — even if the theme is changed somewhere else.
*/
const subscribe = (onChange: () => void) => {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
};
const getTheme = () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

/** The current theme, kept in sync with <html data-theme>. ("light" on the server.) */
export function useTheme(): "light" | "dark" {
  return useSyncExternalStore(subscribe, getTheme, () => "light");
}

/** Switch theme and remember the choice in this browser. */
export function setTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("theme", theme);
  } catch {
    /* storage blocked (private mode) — the switch still works for this visit */
  }
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  // On the server we can't know the theme, so render the default "light"
  // icon there; React corrects it right after load.
  const theme = useTheme();
  const next = theme === "light" ? "dark" : "light";
  const toggle = () => setTheme(next);

  // Callers can pass their own size (e.g. "size-tap" on phones); otherwise 36px.
  const sizing = /(^|\s)(size-|h-)/.test(className) ? "" : "h-9 w-9";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={`grid ${sizing} place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink ${className}`}
    >
      {theme === "light" ? <Moon className="h-[18px] w-[18px]" aria-hidden /> : <Sun className="h-[18px] w-[18px]" aria-hidden />}
    </button>
  );
}
