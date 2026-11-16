"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { LEAVE_TYPES, dayCount, type LeaveInput } from "@/lib/leave";

type EmployeeOption = { id: string; name: string };

const emptyForm = {
  employeeId: "",
  type: LEAVE_TYPES[0] as string,
  startDate: "",
  endDate: "",
  reason: "",
};

export default function LeaveRequestModal({
  open,
  employees,
  fixedEmployeeId,
  onClose,
  onSave,
}: {
  open: boolean;
  employees: EmployeeOption[];
  // When set (self-service), the request is always for this employee and the
  // picker is hidden.
  fixedEmployeeId?: string | null;
  onClose: () => void;
  onSave: (data: LeaveInput) => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  // Reset the form each time the panel opens. This runs during render at the
  // moment `open` flips to true (React's recommended way to respond to a prop
  // change) instead of in an effect, which would render everything twice.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm({ ...emptyForm, employeeId: fixedEmployeeId ?? employees[0]?.id ?? "" });
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

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Live day count preview (0 = invalid range).
  const days = dayCount(form.startDate, form.endDate);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employeeId) {
      setError("Please choose an employee.");
      return;
    }
    if (!form.startDate || !form.endDate) {
      setError("Please pick both a start and end date.");
      return;
    }
    if (days === 0) {
      setError("End date must be on or after the start date.");
      return;
    }
    onSave({
      employeeId: form.employeeId,
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate,
      reason: form.reason,
    });
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-bg px-3 py-2 text-body-md text-ink placeholder:text-ink-faint outline-none transition-colors hover:border-border-strong focus:border-ink focus:ring-1 focus:ring-ink";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-navy/45" onClick={onClose} />

      <div role="dialog" aria-modal="true" className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-modal">
        <div className="flex items-center justify-between border-b border-border px-5 h-16">
          <h2 className="font-display text-headline-sm text-ink">
            {fixedEmployeeId ? "Request leave" : "New leave request"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-full text-ink-muted transition-colors hover:bg-bg hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex-1 space-y-4 p-5">
            {/* Employee picker — hidden in self-service (it's always you) */}
            {!fixedEmployeeId && (
              <Field label="Employee">
                <select
                  className={inputClass}
                  value={form.employeeId}
                  onChange={(e) => update("employeeId", e.target.value)}
                >
                  {employees.length === 0 && <option value="">No employees</option>}
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Type">
              <select
                className={inputClass}
                value={form.type}
                onChange={(e) => update("type", e.target.value)}
              >
                {LEAVE_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Start date">
                <input
                  type="date"
                  className={inputClass}
                  value={form.startDate}
                  onChange={(e) => update("startDate", e.target.value)}
                />
              </Field>
              <Field label="End date">
                <input
                  type="date"
                  className={inputClass}
                  value={form.endDate}
                  onChange={(e) => update("endDate", e.target.value)}
                />
              </Field>
            </div>

            {/* Live day-count preview */}
            <p className="text-body-md text-ink-muted">
              Duration:{" "}
              <span className="font-medium text-ink">
                {days > 0 ? `${days} day${days === 1 ? "" : "s"}` : "—"}
              </span>
            </p>

            <Field label="Reason (optional)">
              <textarea
                className={`${inputClass} min-h-20 resize-y`}
                value={form.reason}
                onChange={(e) => update("reason", e.target.value)}
                placeholder="Add a note…"
              />
            </Field>

            {error && (
              <p role="alert" className="rounded-lg border border-critical/40 bg-critical/10 px-3 py-2 text-body-sm text-critical">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border p-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-full border border-border bg-surface px-5 text-label-md text-ink transition-colors hover:bg-bg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-10 rounded-full bg-accent px-5 text-label-md font-semibold text-on-accent transition-colors hover:bg-accent-hover active:bg-accent-pressed"
            >
              Submit request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
