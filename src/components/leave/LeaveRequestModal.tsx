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

  useEffect(() => {
    if (!open) return;
    setForm({ ...emptyForm, employeeId: fixedEmployeeId ?? employees[0]?.id ?? "" });
    setError("");
  }, [open, employees, fixedEmployeeId]);

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
    "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/40";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 h-16">
          <h2 className="text-base font-semibold text-ink">
            {fixedEmployeeId ? "Request leave" : "New leave request"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-md text-ink-faint hover:bg-surface-2 hover:text-ink"
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
            <p className="text-sm text-ink-muted">
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
              <p className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border p-4">
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
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}
