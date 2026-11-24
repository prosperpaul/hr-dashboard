"use client";

import { useState } from "react";
import { CANDIDATE_STAGES, type CandidateInput } from "@/lib/recruitment";
import BottomSheet from "@/components/ui/BottomSheet";
import { Field, FieldGrid, FormError, inputClass, textareaClass } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";

const emptyForm = {
  name: "",
  email: "",
  stage: "Applied" as string,
  notes: "",
};

const FORM_ID = "candidate-form";

/*
  "Add candidate" form, in a BottomSheet: slides up from the bottom on
  phones, a centred dialog from md up. The sheet handles Escape, focus and
  scroll-lock. Cancel / Add sit in the sheet's sticky footer, which is
  outside the <form>, so the submit button points back at it with form={FORM_ID}.
*/
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

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      eyebrow="Recruitment"
      title="Add candidate"
      description="Add someone to a hiring pipeline"
      footer={
        <>
          {/* Phones: two equal full-width buttons. md+: right-aligned, natural width. */}
          <button type="button" onClick={onClose} className={`${buttonClass("secondary")} flex-1 md:ml-auto md:flex-none`}>
            Cancel
          </button>
          <button type="submit" form={FORM_ID} className={`${buttonClass("primary")} flex-1 md:flex-none`}>
            Add candidate
          </button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Job" required>
          <select className={inputClass} value={jobId} onChange={(e) => setJobId(e.target.value)}>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
        </Field>

        {/* One field per line on phones, side by side from sm up */}
        <FieldGrid>
          <Field label="Full name" required>
            <input
              data-autofocus
              autoComplete="off"
              autoCapitalize="words"
              className={inputClass}
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Jane Doe"
            />
          </Field>

          <Field label="Email">
            <input
              type="email"
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className={inputClass}
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="jane@example.com"
            />
          </Field>
        </FieldGrid>

        <Field label="Stage">
          <select className={inputClass} value={form.stage} onChange={(e) => update("stage", e.target.value)}>
            {CANDIDATE_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Notes">
          <textarea
            className={`${textareaClass} resize-y`}
            value={form.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="Impressions, links…"
          />
        </Field>

        {error && <FormError>{error}</FormError>}
      </form>
    </BottomSheet>
  );
}
