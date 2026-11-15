"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

// Default to the current month as "YYYY-MM".
function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function PayRunModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (period: string) => void;
}) {
  const [period, setPeriod] = useState(currentPeriod());
  const [error, setError] = useState("");

  // Reset the form each time the panel opens. This runs during render at the
  // moment `open` flips to true (React's recommended way to respond to a prop
  // change) instead of in an effect, which would render everything twice.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPeriod(currentPeriod());
      setError("");
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!period.trim()) {
      setError("Please enter a period, e.g. 2026-07.");
      return;
    }
    onCreate(period.trim());
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-surface px-3 py-2 text-body-md text-ink placeholder:text-ink-faint outline-none transition-colors hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-md" onClick={onClose} />

      <div role="dialog" aria-modal="true" className="relative w-full max-w-sm rounded-xl border border-border-strong bg-surface-2 shadow-modal">
        <div className="flex items-center justify-between border-b border-border px-5 h-14">
          <h2 className="text-headline-sm text-ink">New pay run</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <label className="block">
            <span className="mb-1.5 block text-label-sm uppercase tracking-wider text-ink-faint">Pay period</span>
            <input
              className={inputClass}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              placeholder="2026-07"
              autoFocus
            />
          </label>
          <p className="mt-1.5 text-body-sm text-ink-faint">
            Generates a payslip for every employee with a salary set.
          </p>

          {error && (
            <p role="alert" className="mt-3 rounded-lg border border-critical/40 bg-critical/10 px-3 py-2 text-body-sm text-critical">
              {error}
            </p>
          )}

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-lg border border-border bg-surface px-4 text-label-md text-ink-muted transition-colors hover:border-border-strong hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 rounded-lg bg-accent px-4 text-label-md font-semibold text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] transition-colors hover:bg-accent-hover active:bg-accent-pressed"
            >
              Generate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
