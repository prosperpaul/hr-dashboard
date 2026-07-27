"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { CANDIDATE_STAGES, type CandidateInput } from "@/lib/recruitment";

const emptyForm = {
  name: "",
  email: "",
  stage: "Applied" as string,
  notes: "",
};

export default function CandidateFormModal({
  open,
  jobId,
  jobTitle,
  onClose,
  onSave,
}: {
  open: boolean;
  jobId: string;
  jobTitle: string;
  onClose: () => void;
  onSave: (data: CandidateInput) => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm);
    setError("");
  }, [open]);

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
      setError("Please enter the candidate's name.");
      return;
    }
    onSave({
      jobId,
      name: form.name.trim(),
      email: form.email,
      stage: form.stage,
      notes: form.notes,
    });
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/40";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 h-16">
          <div>
            <h2 className="text-base font-semibold text-ink">Add candidate</h2>
            <p className="text-xs text-ink-muted">for {jobTitle}</p>
          </div>
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
                placeholder="jane@example.com"
              />
            </Field>

            <Field label="Stage">
              <select className={inputClass} value={form.stage} onChange={(e) => update("stage", e.target.value)}>
                {CANDIDATE_STAGES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </Field>

            <Field label="Notes">
              <textarea
                className={`${inputClass} min-h-20 resize-y`}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="Impressions, links…"
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
              Add candidate
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
