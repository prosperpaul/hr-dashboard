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
const getTheme = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");

export default function ThemeToggle({ className = "" }: { className?: string }) {
  // On the server we can't know the theme, so render the "dark" icon there;
  // React corrects it right after load.
  const theme = useSyncExternalStore(subscribe, getTheme, () => "dark");
  const next = theme === "light" ? "dark" : "light";

  function toggle() {
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage blocked (private mode) — the switch still works for this visit */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={`grid h-9 w-9 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink ${className}`}
    >
      {theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
    </button>
  );
}
