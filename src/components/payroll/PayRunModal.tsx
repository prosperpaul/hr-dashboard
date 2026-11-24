"use client";

import { useState } from "react";
import BottomSheet from "@/components/ui/BottomSheet";
import { Field, FormError, inputClass } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";

const FORM_ID = "pay-run-form";

/*
  "New pay run" form, in a BottomSheet (slides up on phones, centred dialog
  from md up). The sheet handles Escape, focus and scroll-lock. Its sticky
  footer sits outside the <form>, so Generate points back with form={FORM_ID}.
*/
export default function PayRunModal({
  open,
  defaultPeriod,
  onClose,
  onCreate,
}: {
  open: boolean;
  defaultPeriod: string; // "YYYY-MM" — the current month, decided on the server

  onClose: () => void;
  onCreate: (period: string) => void;
}) {
  const [period, setPeriod] = useState(defaultPeriod);
  const [error, setError] = useState("");

  // Reset the form each time the panel opens. This runs during render at the
  // moment `open` flips to true (React's recommended way to respond to a prop
  // change) instead of in an effect, which would render everything twice.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPeriod(defaultPeriod);
      setError("");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!period.trim()) {
      setError("Please enter a period, e.g. 2026-07.");
      return;
    }
    onCreate(period.trim());
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      eyebrow="Payroll"
      title="New pay run"
      footer={
        <>
          {/* Phones: two equal full-width buttons. md+: right-aligned, natural width. */}
          <button type="button" onClick={onClose} className={`${buttonClass("secondary")} flex-1 md:ml-auto md:flex-none`}>
            Cancel
          </button>
          <button type="submit" form={FORM_ID} className={`${buttonClass("primary")} flex-1 md:flex-none`}>
            Generate
          </button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field label="Pay period" hint="Year and month, e.g. 2026-07. Generates a payslip for every employee with a salary set.">
          <input
            className={`${inputClass} tnum`}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            placeholder="2026-07"
            autoComplete="off"
            inputMode="numeric"
            data-autofocus
          />
        </Field>
        {error && <FormError>{error}</FormError>}
      </form>
    </BottomSheet>
  );
}
