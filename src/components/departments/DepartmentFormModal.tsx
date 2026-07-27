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

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({ name: editing.name, description: editing.description ?? "" });
    } else {
      setForm(emptyForm);
    }
    setError("");
  }, [open, editing]);

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
    "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/40";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 h-16">
          <h2 className="text-base font-semibold text-ink">
            {editing ? "Edit department" : "Add department"}
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
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">Name</span>
              <input
                className={inputClass}
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="e.g. Engineering"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">
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
              {editing ? "Save changes" : "Add department"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
