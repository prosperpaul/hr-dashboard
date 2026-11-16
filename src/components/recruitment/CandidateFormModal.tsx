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
  jobs,
  defaultJobId,
  defaultStage = "Applied",
  onClose,
  onSave,
}: {
  open: boolean;
  jobs: { id: string; title: string }[]; // roles the candidate can apply to
  defaultJobId?: string | null; // pre-selected role
  defaultStage?: string; // e.g. the board column the "+" was clicked in
  onClose: () => void;
  onSave: (data: CandidateInput) => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [jobId, setJobId] = useState("");
  const [error, setError] = useState("");

  // Reset the form each time the panel opens. This runs during render at the
  // moment `open` flips to true (React's recommended way to respond to a prop
  // change) instead of in an effect, which would render everything twice.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm({ ...emptyForm, stage: defaultStage });
      setJobId(defaultJobId ?? jobs[0]?.id ?? "");
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
    if (!jobId) {
      setError("Please choose a job.");
      return;
    }
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
    "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-body-md text-ink placeholder:text-ink-faint outline-none transition-colors hover:border-border-strong focus:border-ink focus:ring-1 focus:ring-ink";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-navy/45" onClick={onClose} />

      <div role="dialog" aria-modal="true" className="relative flex h-full w-full max-w-md flex-col border-l border-border-strong bg-surface-2 shadow-modal">
        <div className="flex items-center justify-between border-b border-border px-5 h-16">
          <div>
            <h2 className="text-headline-sm text-ink">Add candidate</h2>
            <p className="text-body-sm text-ink-muted">Add someone to a hiring pipeline</p>
          </div>
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
            <Field label="Job">
              <select className={inputClass} value={jobId} onChange={(e) => setJobId(e.target.value)}>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.title}</option>
                ))}
              </select>
            </Field>

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
              className="h-10 rounded-full bg-accent px-5 text-label-md text-on-accent transition-colors hover:bg-accent-hover active:bg-accent-pressed"
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
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">{label}</span>
      {children}
    </label>
  );
}
