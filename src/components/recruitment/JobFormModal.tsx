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

  useEffect(() => {
    if (!open) return;
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
    "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/40";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 h-16">
          <h2 className="text-base font-semibold text-ink">{editing ? "Edit job" : "New job"}</h2>
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
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}
