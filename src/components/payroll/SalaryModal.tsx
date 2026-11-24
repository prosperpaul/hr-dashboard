"use client";

import { useState } from "react";
import { formatMoney, type SalaryRow } from "@/lib/payroll";
import BottomSheet from "@/components/ui/BottomSheet";
import { Field, FormError, inputClass } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";

const FORM_ID = "salary-form";

/*
  "Edit salary" form, in a BottomSheet (slides up on phones, centred dialog
  from md up). Save lives in the sheet's sticky footer, outside the <form>,
  so it points back with form={FORM_ID}.
*/
export default function SalaryModal({
  open,
  employee,
  onClose,
  onSave,
}: {
  open: boolean;
  employee: SalaryRow | null;
  onClose: () => void;
  onSave: (employeeId: string, salary: number) => void;
}) {
  const [value, setValue] = useState("0");
  const [error, setError] = useState("");

  // Reset the form each time the panel opens. This runs during render at the
  // moment `open` flips to true (React's recommended way to respond to a prop
  // change) instead of in an effect, which would render everything twice.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && employee) {
      setValue(String(employee.salary));
      setError("");
    }
  }

  const parsed = Number(value);
  const monthlyPreview = Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed / 12) : 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employee) return;
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError("Enter a whole number of 0 or more.");
      return;
    }
    onSave(employee.employeeId, parsed);
  }

  return (
    <BottomSheet
      open={open && employee !== null}
      onClose={onClose}
      eyebrow="Payroll"
      title="Edit salary"
      description={employee ? `Annual gross salary for ${employee.name}` : undefined}
      footer={
        <>
          <button type="button" onClick={onClose} className={`${buttonClass("secondary")} flex-1 md:ml-auto md:flex-none`}>
            Cancel
          </button>
          <button type="submit" form={FORM_ID} className={`${buttonClass("primary")} flex-1 md:flex-none`}>
            Save
          </button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Annual salary (₦)" hint={<span className="tnum">≈ {formatMoney(monthlyPreview)} / month gross</span>}>
          {/* type="number" + inputMode="numeric": phones show the number pad
              (whole Naira only, so no decimal key). Parsing is unchanged. */}
          <input
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            autoComplete="off"
            className={`${inputClass} tnum`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            data-autofocus
          />
        </Field>
        {error && <FormError>{error}</FormError>}
      </form>
    </BottomSheet>
  );
}
