"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { DepartmentRow, DepartmentInput } from "@/lib/department-actions";

const emptyForm = { name: "", description: "" };

export default function DepartmentFormModal({
  open,
  editing,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: DepartmentRow | null; // a department when editing, null when adding
  onClose: () => void;
  onSave: (data: DepartmentInput, id?: string) => void;
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
        setForm({ name: editing.name, description: editing.description ?? "" });
      } else {
        setForm(emptyForm);
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
    if (!form.name.trim()) {
      setError("Please enter a department name.");
      return;
    }
    onSave(
      { name: form.name.trim(), description: form.description.trim() },
      editing?.id,
    );
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-bg px-3 py-2.5 text-body-md text-ink placeholder:text-ink-faint outline-none transition-colors hover:border-border-strong focus:border-ink focus:ring-1 focus:ring-ink";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-navy/45" onClick={onClose} />

      <div role="dialog" aria-modal="true" className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-modal">
        {/* Header: caps eyebrow + title, close button on the right */}
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Department atlas</p>
            <h2 className="mt-1 text-headline-md text-ink">
              {editing ? `Edit ${editing.name}` : "Add a department"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex-1 space-y-5 p-6">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Name</span>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. Engineering"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                Description <span className="text-ink-faint">(optional)</span>
              </span>
              <textarea
                className={`${inputClass} min-h-24 resize-y`}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="What does this team do?"
              />
            </label>

            {error && (
              <p role="alert" className="rounded-lg border border-critical/40 bg-critical/10 px-3 py-2 text-body-sm text-critical">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border bg-bg px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-full border border-border bg-surface px-5 text-label-md text-ink transition-colors hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-10 rounded-full bg-accent px-5 text-label-md font-semibold text-on-accent transition-colors hover:bg-accent-hover active:bg-accent-pressed"
            >
              {editing ? "Save changes" : "Add department"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
