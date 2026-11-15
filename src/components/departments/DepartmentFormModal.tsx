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
    "w-full rounded-lg border border-border bg-surface px-3 py-2 text-body-md text-ink placeholder:text-ink-faint outline-none transition-colors hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-bg/80 backdrop-blur-md" onClick={onClose} />

      <div role="dialog" aria-modal="true" className="relative flex h-full w-full max-w-md flex-col border-l border-border-strong bg-surface-2 shadow-modal">
        <div className="flex items-center justify-between border-b border-border px-5 h-16">
          <h2 className="text-headline-sm text-ink">
            {editing ? "Edit department" : "Add department"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-y-auto">
          <div className="flex-1 space-y-4 p-5">
            <label className="block">
              <span className="mb-1.5 block text-label-sm uppercase tracking-wider text-ink-faint">Name</span>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. Engineering"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-label-sm uppercase tracking-wider text-ink-faint">
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

          <div className="flex items-center justify-end gap-2 border-t border-border p-4">
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
              {editing ? "Save changes" : "Add department"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
