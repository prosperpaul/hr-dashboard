"use client";

import { useState } from "react";
import { LEAVE_TYPES, dayCount, type LeaveInput } from "@/lib/leave";
import BottomSheet from "@/components/ui/BottomSheet";
import { Field, FieldGrid, FormError, inputClass, textareaClass } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";

type EmployeeOption = { id: string; name: string };

const emptyForm = {
  employeeId: "",
  type: LEAVE_TYPES[0] as string,
  startDate: "",
  endDate: "",
  reason: "",
};

const FORM_ID = "leave-request-form";

/*
  The "Request leave" form. It lives in a BottomSheet: a panel that slides
  up from the bottom on phones and a centred dialog from md up. The sheet
  handles Escape, focus and scroll-lock for us.

  The Cancel / Submit buttons sit in the sheet's sticky footer, which is
  rendered outside the <form>, so Submit points back at it with form={FORM_ID}.
*/
export default function LeaveRequestModal({
  open,
  employees,
  fixedEmployeeId,
  onClose,
  onSave,
}: {
  open: boolean;
  employees: EmployeeOption[];
  // When set (self-service), the request is always for this employee and the
  // picker is hidden.
  fixedEmployeeId?: string | null;
  onClose: () => void;
  onSave: (data: LeaveInput) => void;
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
      setForm({ ...emptyForm, employeeId: fixedEmployeeId ?? employees[0]?.id ?? "" });
      setError("");
    }
  }

  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Live day count preview (0 = invalid range).
  const days = dayCount(form.startDate, form.endDate);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.employeeId) {
      setError("Please choose an employee.");
      return;
    }
    if (!form.startDate || !form.endDate) {
      setError("Please pick both a start and end date.");
      return;
    }
    if (days === 0) {
      setError("End date must be on or after the start date.");
      return;
    }
    onSave({
      employeeId: form.employeeId,
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate,
      reason: form.reason,
    });
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={fixedEmployeeId ? "Request leave" : "New leave request"}
      footer={
        <>
          {/* Phones: two equal full-width buttons. md+: right-aligned, natural width. */}
          <button type="button" onClick={onClose} className={`${buttonClass("secondary")} flex-1 md:ml-auto md:flex-none`}>
            Cancel
          </button>
          <button type="submit" form={FORM_ID} className={`${buttonClass("primary")} flex-1 md:flex-none`}>
            Submit request
          </button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Employee picker — hidden in self-service (it's always you) */}
        {!fixedEmployeeId && (
          <Field label="Employee" required>
            <select className={inputClass} value={form.employeeId} onChange={(e) => update("employeeId", e.target.value)}>
              {employees.length === 0 && <option value="">No employees</option>}
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Type" required>
          <select className={inputClass} value={form.type} onChange={(e) => update("type", e.target.value)}>
            {LEAVE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>

        {/* One date per line on phones, side by side from sm up */}
        <FieldGrid>
          <Field label="Start date" required>
            <input type="date" autoComplete="off" className={inputClass} value={form.startDate} onChange={(e) => update("startDate", e.target.value)} />
          </Field>
          <Field label="End date" required>
            <input
              type="date"
              autoComplete="off"
              className={inputClass}
              value={form.endDate}
              min={form.startDate || undefined}
              onChange={(e) => update("endDate", e.target.value)}
            />
          </Field>
        </FieldGrid>

        {/* Live day-count preview */}
        <p className="text-body-md text-ink-muted" aria-live="polite">
          Duration: <span className="tnum font-medium text-ink">{days > 0 ? `${days} day${days === 1 ? "" : "s"}` : "—"}</span>
        </p>

        <Field label="Reason (optional)">
          <textarea className={`${textareaClass} resize-y`} value={form.reason} onChange={(e) => update("reason", e.target.value)} placeholder="Add a note…" />
        </Field>

        {error && <FormError>{error}</FormError>}
      </form>
    </BottomSheet>
  );
}
