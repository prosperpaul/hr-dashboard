"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { ROLES } from "@/lib/permissions";
import type { UserRow, UserInput } from "@/lib/user-actions";

type EmployeeOption = { id: string; name: string };

// A brand-new account starts blank, defaulting to the least-privileged role.
const emptyForm = {
  name: "",
  email: "",
  role: "Employee" as string,
  password: "",
  employeeId: "" as string, // "" = not linked to an employee record
};

export default function UserFormModal({
  open,
  editing,
  employees,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: UserRow | null; // a user when editing, null when adding
  employees: EmployeeOption[];
  onClose: () => void;
  onSave: (data: UserInput, id?: string) => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  // Fill the form when the panel opens (existing values on edit, blank on add).
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        name: editing.name,
        email: editing.email,
        role: editing.role,
        password: "",
        employeeId: editing.employeeId ?? "",
      });
    } else {
      setForm(emptyForm);
    }
    setError("");
  }, [open, editing]);

  // Close on Escape.
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.name.trim() || !form.email.trim()) {
      setError("Please fill in name and email.");
      return;
    }
    // Password is required when creating, optional when editing.
    if (!editing && form.password.trim().length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (editing && form.password && form.password.trim().length < 8) {
      setError("New password must be at least 8 characters (or leave blank).");
      return;
    }

    onSave(
      {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        // Send password only if one was typed (blank = keep current on edit).
        password: form.password.trim() || undefined,
        // Empty = unlinked (null).
        employeeId: form.employeeId || null,
      },
      editing?.id,
    );
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/40";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 h-16">
          <h2 className="text-base font-semibold text-ink">
            {editing ? "Edit account" : "Add account"}
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

            <Field label="Role">
              <select
                className={inputClass}
                value={form.role}
                onChange={(e) => update("role", e.target.value)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </Field>

            <Field label="Linked employee (optional)">
              <select
                className={inputClass}
                value={form.employeeId}
                onChange={(e) => update("employeeId", e.target.value)}
              >
                <option value="">Not linked</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </Field>

            <Field label={editing ? "New password (leave blank to keep current)" : "Password"}>
              <input
                type="password"
                className={inputClass}
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder={editing ? "••••••••" : "At least 8 characters"}
                autoComplete="new-password"
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
              {editing ? "Save changes" : "Add account"}
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
