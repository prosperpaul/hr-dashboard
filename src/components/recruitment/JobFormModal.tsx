"use client";

import { useState } from "react";
import { JOB_STATUSES, EMPLOYMENT_TYPES, type JobRow, type JobInput } from "@/lib/recruitment";
import BottomSheet from "@/components/ui/BottomSheet";
import { Field, FieldGrid, FormError, inputClass, textareaClass } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";

type DeptOption = { id: string; name: string };

const emptyForm = {
  title: "",
  departmentId: "",
  location: "",
  type: "Full-time" as string,
  status: "Open" as string,
  description: "",
};

const FORM_ID = "job-form";

/*
  "Post a job" / "Edit job" form, in a BottomSheet (bottom sheet on phones,
  centred dialog from md up). The footer buttons are outside the <form>, so
  the submit button points back at it with form={FORM_ID}.
*/
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

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      eyebrow="Recruitment"
      title={editing ? "Edit job" : "New job"}
      footer={
        <>
          <button type="button" onClick={onClose} className={`${buttonClass("secondary")} flex-1 md:ml-auto md:flex-none`}>
            Cancel
          </button>
          <button type="submit" form={FORM_ID} className={`${buttonClass("primary")} flex-1 md:flex-none`}>
            {editing ? "Save changes" : "Create job"}
          </button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Job title" required>
          <input
            data-autofocus
            autoComplete="off"
            className={inputClass}
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder="e.g. Senior Frontend Engineer"
          />
        </Field>

        {/* One field per line on phones, two side by side from sm up */}
        <FieldGrid>
          <Field label="Department">
            <select className={inputClass} value={form.departmentId} onChange={(e) => update("departmentId", e.target.value)}>
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Location">
            <input
              autoComplete="off"
              className={inputClass}
              value={form.location}
              onChange={(e) => update("location", e.target.value)}
              placeholder="e.g. Remote, New York"
            />
          </Field>

          <Field label="Type">
            <select className={inputClass} value={form.type} onChange={(e) => update("type", e.target.value)}>
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select className={inputClass} value={form.status} onChange={(e) => update("status", e.target.value)}>
              {JOB_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </FieldGrid>

        <Field label="Description">
          <textarea
            className={`${textareaClass} resize-y`}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Role summary, requirements…"
          />
        </Field>

        {error && <FormError>{error}</FormError>}
      </form>
    </BottomSheet>
  );
}
