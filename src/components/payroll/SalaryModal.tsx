"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { formatMoney, type SalaryRow } from "@/lib/payroll";

export default function SalaryModal({
  open,
  employee,
  onClose,
  onSave,
}: {
  open: boolean;
  employee: SalaryRow | null;
  onClose: () => void;
  onSave: (employeeId: string, salary: number) => void;
}) {
  const [value, setValue] = useState("0");
  const [error, setError] = useState("");

  // Reset the form each time the panel opens. This runs during render at the
  // moment `open` flips to true (React's recommended way to respond to a prop
  // change) instead of in an effect, which would render everything twice.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && employee) {
      setValue(String(employee.salary));
      setError("");
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !employee) return null;

  const parsed = Number(value);
  const monthlyPreview = Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed / 12) : 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError("Enter a whole number of 0 or more.");
      return;
    }
    onSave(employee!.employeeId, parsed);
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-surface px-3 py-2 text-body-md text-ink placeholder:text-ink-faint outline-none transition-colors hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-md" onClick={onClose} />

      <div role="dialog" aria-modal="true" className="relative w-full max-w-sm rounded-xl border border-border-strong bg-surface-2 shadow-modal">
        <div className="flex items-center justify-between border-b border-border px-5 h-14">
          <h2 className="text-headline-sm text-ink">Edit salary</h2>
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
          <p className="text-body-md text-ink-muted">
            Annual gross salary for <span className="font-medium text-ink">{employee.name}</span>
          </p>
          <div className="mt-3">
            <input
              type="number"
              min={0}
              step={1}
              className={inputClass}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
            <p className="mt-1.5 text-body-sm text-ink-faint">
              ≈ {formatMoney(monthlyPreview)} / month gross
            </p>
          </div>

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
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
