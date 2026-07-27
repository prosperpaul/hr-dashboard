"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { employeeStatuses, type Employee } from "@/lib/sample-data";
import type { EmployeeInput } from "@/lib/employee-actions";
import type { DeptOption } from "./EmployeesManager";

// A brand-new employee starts with empty fields (except sensible defaults).
const emptyForm = {
  name: "",
  email: "",
  role: "",
  departmentId: "" as string, // filled with the first department on open
  status: employeeStatuses[0] as Employee["status"],
  startedAt: "",
  leaveAllowance: "20", // kept as a string for the input; parsed on save
};

export default function EmployeeFormModal({
  open,
  editing,
  departments,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: Employee | null; // an employee when editing, null when adding
  departments: DeptOption[];
  onClose: () => void;
  onSave: (data: EmployeeInput, id?: string) => void;
}) {
  // The form's current field values.
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  // When the panel opens, fill it: with the employee's data (edit) or blank (add).
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        email: editing.email,
        role: editing.role,
        departmentId: editing.departmentId ?? "",
        status: editing.status,
        startedAt: editing.startedAt,
        leaveAllowance: String(editing.leaveAllowance),
      });
    } else {
      // Default a new employee to the first department in the list.
      setForm({ ...emptyForm, departmentId: departments[0]?.id ?? "" });
    }
    setError("");
  }, [open, editing, departments]);

  // Close the panel when the Escape key is pressed.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // A small helper to update one field of the form.
  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Basic validation — make sure required fields are filled.
    if (!form.name.trim() || !form.email.trim() || !form.role.trim()) {
      setError("Please fill in name, email, and role.");
      return;
    }

    // Parse the allowance; must be a whole number 0 or more.
    const allowance = Number(form.leaveAllowance);
    if (!Number.isInteger(allowance) || allowance < 0) {
      setError("Leave allowance must be a whole number of days (0 or more).");
      return;
    }

    onSave(
      {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role.trim(),
        // Empty selection means "unassigned" → null.
        departmentId: form.departmentId || null,
        status: form.status,
        startedAt: form.startedAt || new Date().toISOString().slice(0, 10),
        leaveAllowance: allowance,
      },
      editing?.id
    );
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/40";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Dark backdrop — clicking it closes the panel */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* The panel itself */}
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 h-16">
          <h2 className="text-base font-semibold text-ink">
            {editing ? "Edit employee" : "Add employee"}
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
            <Field label="Full name">
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. Jane Doe"
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                className={inputClass}
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="jane.doe@company.com"
              />
            </Field>

            <Field label="Job title / role">
              <input
                className={inputClass}
                value={form.role}
                onChange={(e) => update("role", e.target.value)}
                placeholder="e.g. Product Designer"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Department">
                <select
                  className={inputClass}
                  value={form.departmentId}
                  onChange={(e) => update("departmentId", e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </Field>

              <Field label="Status">
                <select
                  className={inputClass}
                  value={form.status}
                  onChange={(e) => update("status", e.target.value)}
                >
                  {employeeStatuses.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Start date">
                <input
                  type="date"
                  className={inputClass}
                  value={form.startedAt}
                  onChange={(e) => update("startedAt", e.target.value)}
                />
              </Field>

              <Field label="Leave allowance (days/yr)">
                <input
                  type="number"
                  min={0}
                  step={1}
                  className={inputClass}
                  value={form.leaveAllowance}
                  onChange={(e) => update("leaveAllowance", e.target.value)}
                />
              </Field>
            </div>

            {error && (
              <p className="rounded-lg border border-critical/30 bg-critical/10 px-3 py-2 text-sm text-critical">
                {error}
              </p>
            )}
          </div>

          {/* Footer actions */}
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
              {editing ? "Save changes" : "Add employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// A small label + input wrapper, reused for each field.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}
