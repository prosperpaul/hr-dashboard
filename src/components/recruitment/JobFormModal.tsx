"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { JOB_STATUSES, EMPLOYMENT_TYPES, type JobRow, type JobInput } from "@/lib/recruitment";

type DeptOption = { id: string; name: string };

const emptyForm = {
  title: "",
  departmentId: "",
  location: "",
  type: "Full-time" as string,
  status: "Open" as string,
  description: "",
};

export default function JobFormModal({
  open,
  editing,
  departments,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: JobRow | null;
  departments: DeptOption[];
  onClose: () => void;
  onSave: (data: JobInput, id?: string) => void;
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
          title: editing.title,
          departmentId: editing.departmentId ?? "",
          location: editing.location ?? "",
          type: editing.type,
          status: editing.status,
          description: editing.description ?? "",
        });
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
    if (!form.title.trim()) {
      setError("Please enter a job title.");
      return;
    }
    onSave(
      {
        title: form.title.trim(),
        departmentId: form.departmentId || null,
        location: form.location,
        type: form.type,
        status: form.status,
        description: form.description,
      },
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
          <h2 className="text-headline-sm text-ink">{editing ? "Edit job" : "New job"}</h2>
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
            <Field label="Job title">
              <input
                className={inputClass}
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                placeholder="e.g. Senior Frontend Engineer"
              />
            </Field>

            <Field label="Department">
              <select
                className={inputClass}
                value={form.departmentId}
                onChange={(e) => update("departmentId", e.target.value)}
              >
                <option value="">—</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Location">
              <input
                className={inputClass}
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
                placeholder="e.g. Remote, New York"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Type">
                <select className={inputClass} value={form.type} onChange={(e) => update("type", e.target.value)}>
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select className={inputClass} value={form.status} onChange={(e) => update("status", e.target.value)}>
                  {JOB_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Description">
              <textarea
                className={`${inputClass} min-h-24 resize-y`}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="Role summary, requirements…"
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
              className="h-9 rounded-lg border border-border bg-surface px-4 text-label-md text-ink-muted transition-colors hover:border-border-strong hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="h-9 rounded-lg bg-accent px-4 text-label-md font-semibold text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] transition-colors hover:bg-accent-hover active:bg-accent-pressed"
            >
              {editing ? "Save changes" : "Create job"}
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
      <span className="mb-1.5 block text-label-sm uppercase tracking-wider text-ink-faint">{label}</span>
      {children}
    </label>
  );
}
