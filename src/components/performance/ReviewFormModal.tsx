"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { RATING_LABELS, type ReviewRow, type ReviewInput } from "@/lib/performance";
import BottomSheet from "@/components/ui/BottomSheet";
import { buttonClass } from "@/components/ui/button";
import { Field, FormError, inputClass, textareaClass } from "@/components/ui/form";

type EmployeeOption = { id: string; name: string };

const emptyForm = {
  employeeId: "",
  period: "",
  rating: "3",
  strengths: "",
  goals: "",
};

const FORM_ID = "review-form";

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

  const rating = Number(form.rating);

  // A bottom sheet on phones, a centred dialog from md up. The buttons live in
  // the sheet's sticky footer (outside the <form>), so they point at the form
  // with form={FORM_ID}.
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      eyebrow="Performance"
      title={editing ? "Edit review" : "New review"}
      footer={
        <>
          <button type="button" onClick={onClose} className={`${buttonClass("secondary")} flex-1 md:ml-auto md:flex-none`}>
            Cancel
          </button>
          <button type="submit" form={FORM_ID} className={`${buttonClass("primary")} flex-1 md:flex-none`}>
            {editing ? "Save changes" : "Create review"}
          </button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* When editing, the employee is fixed (shown, not changeable). */}
        {editing ? (
          <Field label="Employee">
            <input className={inputClass} value={editing.employeeName} disabled />
          </Field>
        ) : (
          <Field label="Employee" required>
            <select data-autofocus className={inputClass} value={form.employeeId} onChange={(e) => update("employeeId", e.target.value)}>
              {employees.length === 0 && <option value="">No employees</option>}
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Review period" required>
          <input
            className={inputClass}
            value={form.period}
            onChange={(e) => update("period", e.target.value)}
            placeholder="e.g. H1 2026"
            autoComplete="off"
            data-autofocus={editing ? true : undefined}
          />
        </Field>

        {/* Star rating: five real radio buttons (hidden) inside 48px star
            labels, so it works by tap, click, or keyboard (Tab in, then the
            arrow keys move between stars). */}
        <fieldset className="min-w-0">
          <legend className="mb-1.5 block text-label-md text-ink">Overall rating</legend>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <div className="-ml-2 flex items-center">
              {[1, 2, 3, 4, 5].map((n) => (
                <label
                  key={n}
                  className="grid size-tap cursor-pointer place-items-center rounded-full transition-colors hover:bg-surface-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink"
                >
                  <input
                    type="radio"
                    name="rating"
                    value={n}
                    checked={rating === n}
                    onChange={() => update("rating", String(n))}
                    className="sr-only"
                  />
                  <span className="sr-only">
                    {n} — {RATING_LABELS[n]}
                  </span>
                  <Star aria-hidden className={`h-7 w-7 ${n <= rating ? "fill-accent text-accent-ink" : "text-border-strong"}`} />
                </label>
              ))}
            </div>
            <p aria-hidden className="tnum text-body-md text-ink">
              <span className="font-bold">{rating}</span> · {RATING_LABELS[rating]}
            </p>
          </div>
        </fieldset>

        <Field label="Strengths">
          <textarea className={`${textareaClass} resize-y`} value={form.strengths} onChange={(e) => update("strengths", e.target.value)} placeholder="What went well…" />
        </Field>

        <Field label="Goals / areas to improve">
          <textarea className={`${textareaClass} resize-y`} value={form.goals} onChange={(e) => update("goals", e.target.value)} placeholder="Focus for next period…" />
        </Field>

        {error && <FormError>{error}</FormError>}
      </form>
    </BottomSheet>
  );
}
