"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { RATING_LABELS, type ReviewRow, type ReviewInput } from "@/lib/performance";

type EmployeeOption = { id: string; name: string };

const emptyForm = {
  employeeId: "",
  period: "",
  rating: "3",
  strengths: "",
  goals: "",
};

export default function ReviewFormModal({
  open,
  editing,
  employees,
  defaultEmployeeId,
  defaultPeriod,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: ReviewRow | null;
  employees: EmployeeOption[];
  defaultEmployeeId?: string | null; // pre-select someone (e.g. "Start review" on their row)
  defaultPeriod?: string; // pre-fill the cycle being viewed
  onClose: () => void;
  onSave: (data: ReviewInput, id?: string) => void;
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
      if (editing) {
        setForm({
          employeeId: editing.employeeId,
          period: editing.period,
          rating: String(editing.rating),
          strengths: editing.strengths ?? "",
          goals: editing.goals ?? "",
        });
      } else {
        setForm({ ...emptyForm, employeeId: defaultEmployeeId ?? employees[0]?.id ?? "", period: defaultPeriod ?? "" });
      }
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employeeId) {
      setError("Please choose an employee.");
      return;
    }
    if (!form.period.trim()) {
      setError("Please enter a review period (e.g. H1 2026).");
      return;
    }
    onSave(
      {
        employeeId: form.employeeId,
        period: form.period.trim(),
        rating: Number(form.rating),
        strengths: form.strengths,
        goals: form.goals,
      },
      editing?.id,
    );
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-bg px-3 py-2 text-body-md text-ink placeholder:text-ink-faint outline-none transition-colors hover:border-border-strong focus:border-ink focus:ring-1 focus:ring-ink";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-navy/45" onClick={onClose} />

      <div role="dialog" aria-modal="true" className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-modal">
        <div className="flex items-center justify-between border-b border-border px-5 h-16">
          <h2 className="font-display text-headline-sm text-ink">
            {editing ? "Edit review" : "New review"}
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
            {/* When editing, the employee is fixed (shown, not changeable). */}
            {editing ? (
              <Field label="Employee">
                <input className={`${inputClass} opacity-70`} value={editing.employeeName} disabled />
              </Field>
            ) : (
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

            <Field label="Review period">
              <input
                className={inputClass}
                value={form.period}
                onChange={(e) => update("period", e.target.value)}
                placeholder="e.g. H1 2026"
              />
            </Field>

            <Field label="Overall rating">
              <select
                className={inputClass}
                value={form.rating}
                onChange={(e) => update("rating", e.target.value)}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n} — {RATING_LABELS[n]}</option>
                ))}
              </select>
            </Field>

            <Field label="Strengths">
              <textarea
                className={`${inputClass} min-h-20 resize-y`}
                value={form.strengths}
                onChange={(e) => update("strengths", e.target.value)}
                placeholder="What went well…"
              />
            </Field>

            <Field label="Goals / areas to improve">
              <textarea
                className={`${inputClass} min-h-20 resize-y`}
                value={form.goals}
                onChange={(e) => update("goals", e.target.value)}
                placeholder="Focus for next period…"
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
              {editing ? "Save changes" : "Create review"}
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
