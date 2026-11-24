"use client";

import { useState } from "react";
import type { DepartmentRow, DepartmentInput } from "@/lib/department-actions";
import BottomSheet from "@/components/ui/BottomSheet";
import { buttonClass } from "@/components/ui/button";
import { Field, FormError, inputClass, textareaClass } from "@/components/ui/form";

const emptyForm = { name: "", description: "" };
const FORM_ID = "department-form";

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

  // A bottom sheet on phones, a centred dialog on desktop. Escape, the
  // backdrop and the focus trap are handled by BottomSheet. The buttons
  // live in its sticky footer (outside the <form>), so the submit button
  // points back at the form with form={FORM_ID}.
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      eyebrow="Department atlas"
      title={editing ? `Edit ${editing.name}` : "Add a department"}
      footer={
        <>
          <button type="button" onClick={onClose} className={`${buttonClass("secondary")} flex-1 md:ml-auto md:flex-none`}>
            Cancel
          </button>
          <button type="submit" form={FORM_ID} className={`${buttonClass("primary")} flex-1 md:flex-none`}>
            {editing ? "Save changes" : "Add department"}
          </button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-5">
        <Field label="Name" required>
          <input
            data-autofocus
            className={inputClass}
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="e.g. Engineering"
            autoComplete="off"
            enterKeyHint="next"
          />
        </Field>

        <Field label="Description" hint="Optional">
          <textarea
            className={`${textareaClass} resize-y`}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="What does this team do?"
          />
        </Field>

        {error && <FormError>{error}</FormError>}
      </form>
    </BottomSheet>
  );
}
