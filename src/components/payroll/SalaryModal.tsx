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

  useEffect(() => {
    if (!open || !employee) return;
    setValue(String(employee.salary));
    setError("");
  }, [open, employee]);

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
    "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/40";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 h-14">
          <h2 className="text-base font-semibold text-ink">Edit salary</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-md text-ink-faint hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5">
          <p className="text-sm text-ink-muted">
            Annual gross salary for <span className="font-medium text-ink">{employee.name}</span>
          </p>
          <div className="mt-3">
            <input
              type="number"
              min={0}
              step={1000}
              className={inputClass}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
            />
            <p className="mt-1.5 text-xs text-ink-faint">
              ≈ {formatMoney(monthlyPreview)} / month gross
            </p>
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
              {error}
            </p>
          )}

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2 text-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
