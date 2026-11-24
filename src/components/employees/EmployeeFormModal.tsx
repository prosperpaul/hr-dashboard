"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Pencil, Sparkles, UserPlus } from "lucide-react";
import { employeeStatuses, type Employee } from "@/lib/sample-data";
import type { EmployeeInput } from "@/lib/employee-actions";
import type { DeptOption } from "./EmployeesManager";
import EmployeeAvatar from "./EmployeeAvatar";
import StatusBadge from "./StatusBadge";
import { formatDate } from "./employee-format";
import BottomSheet from "@/components/ui/BottomSheet";
import { buttonClass } from "@/components/ui/button";
import { Field, FieldGrid, FormError, inputClass } from "@/components/ui/form";

// A brand-new employee starts with empty fields (except sensible defaults).
const emptyForm = {
  name: "",
  email: "",
  role: "",
  departmentId: "" as string, // filled with the first department on open
  status: employeeStatuses[0] as Employee["status"],
  startedAt: "",
  leaveAllowance: "20", // kept as a string for the input; parsed on save
};

/*
  On phones (below md) the form is a step-by-step wizard, one section per
  step, ending with a "Review & confirm" summary. From md up the same
  sections are simply all shown at once (the original single form).
*/
const STEPS = ["Personal details", "Job & department", "Time off", "Review & confirm"] as const;
const REVIEW = STEPS.length - 1;

// True while the phone wizard is in use (the md breakpoint is 48rem = 768px).
// Only called from click/submit handlers, never during render.
const isWizard = () => !window.matchMedia("(min-width: 48rem)").matches;

export default function EmployeeFormModal({
  open,
  editing,
  created,
  departments,
  onClose,
  onSave,
  onAddAnother,
}: {
  open: boolean;
  editing: Employee | null; // an employee when editing, null when adding
  created?: Employee | null; // set right after a NEW employee is saved → success screen
  departments: DeptOption[];
  onClose: () => void;
  onSave: (data: EmployeeInput, id?: string) => void;
  onAddAnother?: () => void; // leave the success screen for a fresh blank form
}) {
  // The form's current field values.
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [step, setStep] = useState(0); // phone wizard only
  const formRef = useRef<HTMLFormElement>(null);

  // Reset the form each time the dialog opens: with the employee's data
  // (edit) or blank (add). This runs during render at the moment `open`
  // flips to true (React's recommended way to respond to a prop change)
  // instead of in an effect, which would render everything twice.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      if (editing) {
        setForm({
          name: editing.name,
          email: editing.email,
          role: editing.role,
          departmentId: editing.departmentId ?? "",
          status: editing.status,
          startedAt: editing.startedAt,
          leaveAllowance: String(editing.leaveAllowance),
        });
      } else {
        // Default a new employee to the first department in the list.
        setForm({ ...emptyForm, departmentId: departments[0]?.id ?? "" });
      }
      setError("");
      setStep(0);
    }
  }

  // When the success screen appears, move keyboard/screen-reader focus to
  // its headline (the Save button that had focus has just disappeared).
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (created) successHeadingRef.current?.focus();
  }, [created]);

  // "Add another employee": back to a blank form, first field focused.
  function addAnother() {
    onAddAnother?.();
    setForm({ ...emptyForm, departmentId: departments[0]?.id ?? "" });
    setError("");
    setStep(0);
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus());
  }

  // A small helper to update one field of the form.
  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // The same validation rules as always, split by the step their fields
  // live on, so the phone wizard can check one step before moving on.
  function stepError(s: number): string {
    if (s === 0 && (!form.name.trim() || !form.email.trim())) return "Please fill in name and email.";
    if (s === 1 && !form.role.trim()) return "Please fill in the role.";
    if (s === 2) {
      const n = Number(form.leaveAllowance);
      if (!Number.isInteger(n) || n < 0) return "Leave allowance must be a whole number of days (0 or more).";
    }
    return "";
  }

  // Phone wizard: jump to a step and scroll the sheet back to its top.
  function goTo(s: number) {
    setError("");
    setStep(s);
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ block: "start" }));
  }
  function next() {
    const err = stepError(step);
    if (err) return setError(err);
    goTo(step + 1);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Phone wizard: pressing Enter (or "Go" on the keyboard) mid-way means
    // "continue", not "save" — saving only happens on the review step.
    if (isWizard() && step < REVIEW) return next();

    // Basic validation — make sure required fields are filled.
    if (!form.name.trim() || !form.email.trim() || !form.role.trim()) {
      setError("Please fill in name, email, and role.");
      if (isWizard()) setStep(!form.name.trim() || !form.email.trim() ? 0 : 1);
      return;
    }

    // Parse the allowance; must be a whole number 0 or more.
    const allowance = Number(form.leaveAllowance);
    if (!Number.isInteger(allowance) || allowance < 0) {
      setError("Leave allowance must be a whole number of days (0 or more).");
      if (isWizard()) setStep(2);
      return;
    }

    onSave(
      {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role.trim(),
        // Empty selection means "unassigned" → null.
        departmentId: form.departmentId || null,
        status: form.status,
        // Runs on click (not during render), so reading the clock here is fine.
        startedAt: form.startedAt || new Date().toISOString().slice(0, 10),
        leaveAllowance: allowance,
      },
      editing?.id
    );
  }

  // Values for the live preview card (falls back to placeholders while empty).
  const deptName = departments.find((d) => d.id === form.departmentId)?.name ?? null;
  const previewName = form.name.trim() || "New teammate";
  const formId = editing ? `employee-form-${editing.id}` : "employee-form-new";
  const submitLabel = editing ? "Save changes" : "Create employee";
  // Phones: hide every section except the current step's. md+: always shown.
  const stepClass = (s: number) => (s === step ? "" : "hidden md:block");

  /*
    A BottomSheet: a full-width sheet sliding up on phones, a centred dialog
    from md up (it handles Escape, focus and scroll-locking for us). Fields
    are one column on phones (FieldGrid), and Save / Cancel live in the
    sheet's sticky footer so they stay reachable while you scroll. The
    footer sits outside the <form>, so the Save button points at it with form={formId}.
  */
  // Just created someone → the "Welcome to the team" milestone instead of the form.
  if (created && !editing) {
    return (
      <BottomSheet open={open} onClose={onClose} size="lg" eyebrow="Employee onboarding" title="Employee added">
        <NewHireSuccess employee={created} headingRef={successHeadingRef} onAddAnother={addAnother} />
      </BottomSheet>
    );
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      size="lg"
      eyebrow={editing ? "Employee record · Edit" : "Employee onboarding"}
      title={editing ? `Update ${editing.name.split(" ")[0]}'s details` : "Welcome a new teammate"}
      description={editing ? "Changes apply everywhere this person appears." : "Set up their identity, job details and time-off allowance."}
      footer={
        <>
          {/* Phones: wizard buttons — Cancel/Back on the left, a wider yellow
              Continue (or the final save on the review step) on the right. */}
          <button
            type="button"
            onClick={step === 0 ? onClose : () => goTo(step - 1)}
            className={`${buttonClass("secondary")} flex-1 md:hidden`}
          >
            {step === 0 ? (
              "Cancel"
            ) : (
              <>
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back
              </>
            )}
          </button>
          {step < REVIEW ? (
            <button type="button" onClick={next} className={`${buttonClass("primary")} flex-[2] md:hidden`}>
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          ) : (
            <button type="submit" form={formId} className={`${buttonClass("primary")} flex-[2] md:hidden`}>
              {submitLabel}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          )}

          {/* md and up: the original single form's Cancel / Save. */}
          <button type="button" onClick={onClose} className={`${buttonClass("secondary")} max-md:hidden md:ml-auto`}>
            Cancel
          </button>
          <button type="submit" form={formId} className={`${buttonClass("primary")} max-md:hidden`}>
            {editing ? "Save changes" : "Add employee"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </>
      }
    >
      <form ref={formRef} id={formId} onSubmit={handleSubmit} className="scroll-mt-4 space-y-6 md:space-y-8">
        {/* Phones: "Step N of M" + one progress segment per step (the current
            and finished ones filled yellow). */}
        <div className="md:hidden">
          <div className="mb-2 flex items-center justify-between gap-3 text-eyebrow uppercase">
            <span className="tnum text-ink-muted">
              Step {step + 1} of {STEPS.length}
            </span>
            <span className="text-ink">{step === REVIEW ? "Final step" : STEPS[step]}</span>
          </div>
          <div
            className="flex gap-1.5"
            role="progressbar"
            aria-label="Form progress"
            aria-valuemin={1}
            aria-valuemax={STEPS.length}
            aria-valuenow={step + 1}
            aria-valuetext={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
          >
            {STEPS.map((label, i) => (
              <span key={label} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-sunken"}`} />
            ))}
          </div>
        </div>

        {/* Live preview of the directory card: a compact strip on tablet/desktop
            only (on a phone it would push the fields off screen). */}
        <aside aria-label="Live preview" className="hidden rounded-xl border border-navy-line bg-navy p-4 text-on-navy md:block">
          <div className="flex items-center justify-between gap-3">
            <p className="text-eyebrow uppercase text-on-navy-muted">Live preview</p>
            <span className="inline-flex h-6 items-center rounded-full bg-accent px-2.5 text-eyebrow uppercase text-on-accent">
              {editing ? "Team member" : "Welcome to the team"}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <EmployeeAvatar name={previewName} department={deptName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-headline-sm">{previewName}</p>
              <p className="truncate text-body-sm text-on-navy-muted">
                {form.role.trim() || "Role to be set"} · {deptName ?? "Unassigned"}
              </p>
            </div>
            <StatusBadge status={form.status} variant="pill" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm text-on-navy-muted">
            <span className="min-w-0 truncate">{form.email.trim() || "email@company.com"}</span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-accent" aria-hidden />
              <span className="tnum">Starts {form.startedAt ? formatDate(form.startedAt) : "today"}</span>
            </span>
            <span className="tnum">{form.leaveAllowance || 0} days leave</span>
          </div>
        </aside>

        <Section number="01" title="Personal details" hint="Who they are and how to reach them." className={stepClass(0)}>
          <Field label="Full name" required>
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              data-autofocus
              placeholder="e.g. Jane Doe"
              autoComplete="name"
              autoCapitalize="words"
              enterKeyHint="next"
            />
          </Field>
          <Field label="Work email" required>
            <input
              type="email"
              autoComplete="email"
              autoCapitalize="off"
              spellCheck={false}
              enterKeyHint="next"
              className={inputClass}
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="jane.doe@company.com"
            />
          </Field>
        </Section>

        <Section number="02" title="Job & department" hint="Where they sit and when they start." className={stepClass(1)}>
          <Field label="Job title / role" required wide>
            <input
              className={inputClass}
              value={form.role}
              onChange={(e) => update("role", e.target.value)}
              placeholder="e.g. Product Designer"
              autoComplete="organization-title"
              enterKeyHint="next"
            />
          </Field>
          <Field label="Department">
            <select className={inputClass} value={form.departmentId} onChange={(e) => update("departmentId", e.target.value)}>
              <option value="">Unassigned</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select className={inputClass} value={form.status} onChange={(e) => update("status", e.target.value)}>
              {employeeStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Start date" hint="Leave blank to use today.">
            <input type="date" autoComplete="off" className={inputClass} value={form.startedAt} onChange={(e) => update("startedAt", e.target.value)} />
          </Field>
        </Section>

        <Section number="03" title="Time off" hint="Paid days per year (vacation + personal leave count against it)." className={stepClass(2)}>
          <Field label="Leave allowance (days / yr)">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              autoComplete="off"
              enterKeyHint="done"
              className={`${inputClass} tnum`}
              value={form.leaveAllowance}
              onChange={(e) => update("leaveAllowance", e.target.value)}
            />
          </Field>
        </Section>

        {/* Phones, last step: a read-only summary of everything entered, each
            card with an Edit button that jumps back to its step. */}
        {step === REVIEW && (
          <div className="space-y-4 md:hidden">
            <div>
              <p className="text-eyebrow uppercase text-ink-muted">Step {STEPS.length} of {STEPS.length} · Final review</p>
              <h3 className="font-display text-headline-md text-ink">Review &amp; confirm</h3>
              <p className="text-body-sm text-ink-muted">Double-check {previewName.split(" ")[0]}&apos;s details before saving.</p>
            </div>
            <ReviewCard title="Personal details" onEdit={() => goTo(0)}>
              <div className="flex items-center gap-3 rounded-lg bg-sunken p-3">
                <EmployeeAvatar name={previewName} department={deptName} size="sm" />
                <p className="min-w-0 truncate font-display text-headline-sm text-ink">{previewName}</p>
              </div>
              <ReviewRow label="Work email" value={form.email.trim()} />
            </ReviewCard>
            <ReviewCard title="Job & department" onEdit={() => goTo(1)}>
              <ReviewRow label="Job title / role" value={form.role.trim()} />
              <ReviewRow label="Department" value={deptName ?? "Unassigned"} />
              <div className="grid grid-cols-2 gap-3">
                <ReviewRow label="Status" value={form.status} />
                <ReviewRow label="Start date" value={form.startedAt ? formatDate(form.startedAt) : "Today"} />
              </div>
            </ReviewCard>
            <ReviewCard title="Time off" onEdit={() => goTo(2)}>
              <ReviewRow label="Leave allowance" value={`${form.leaveAllowance || 0} days / yr`} />
            </ReviewCard>
          </div>
        )}

        {error && <FormError>{error}</FormError>}
      </form>
    </BottomSheet>
  );
}

/*
  The success screen after adding a new employee: a yellow check badge,
  "Welcome to the team, <first name>!", a summary card of what was saved,
  then two next steps — open their profile, or add someone else.
  Every value comes from the record the server just returned.
*/
function NewHireSuccess({
  employee,
  headingRef,
  onAddAnother,
}: {
  employee: Employee;
  headingRef: React.Ref<HTMLHeadingElement>;
  onAddAnother: () => void;
}) {
  const firstName = employee.name.split(" ")[0];
  return (
    <div className="flex flex-col items-center py-2 text-center md:py-4">
      {/* Check in a butter circle, with a soft halo ring and a little sparkle */}
      <span className="relative grid size-20 place-items-center rounded-full bg-accent-soft">
        <span className="grid size-14 place-items-center rounded-full bg-accent text-on-accent">
          <Check className="size-7" strokeWidth={3} aria-hidden />
        </span>
        <Sparkles className="absolute -right-1 -top-1 size-5 text-accent-ink" aria-hidden />
      </span>
      <p className="mt-4 text-eyebrow uppercase text-ink-muted">New hire confirmed</p>
      {/* tabIndex=-1 lets us move focus here without adding it to the Tab order */}
      <h3 ref={headingRef} tabIndex={-1} className="mt-1 text-headline-lg text-ink text-balance outline-none [overflow-wrap:anywhere]">
        Welcome to the team, {firstName}!
      </h3>

      {/* Summary card: initials, name, role, then department + start date */}
      <div className="mt-5 w-full rounded-xl bg-sunken p-4 text-left">
        <div className="flex items-center gap-3">
          <EmployeeAvatar name={employee.name} department={employee.departmentId ? employee.department : null} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-display text-headline-sm text-ink">{employee.name}</p>
            <p className="truncate text-body-sm text-ink-muted">{employee.role}</p>
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-border pt-3">
          <div className="min-w-0">
            <dt className="text-label-sm text-ink-muted">Department</dt>
            <dd className="truncate text-label-md font-semibold text-ink">{employee.department}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-label-sm text-ink-muted">Start date</dt>
            <dd className="tnum text-label-md font-semibold text-ink">{formatDate(employee.startedAt)}</dd>
          </div>
        </dl>
      </div>

      {/* Phones: full-width stacked buttons. sm+: side by side. */}
      <div className="mt-5 flex w-full flex-col gap-3 sm:flex-row-reverse">
        <Link href={`/employees/${employee.id}`} className={`${buttonClass("primary")} w-full sm:flex-1`}>
          View employee profile
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
        <button type="button" onClick={onAddAnother} className={`${buttonClass("secondary")} w-full sm:flex-1`}>
          <UserPlus className="h-4 w-4" aria-hidden />
          Add another employee
        </button>
      </div>
    </div>
  );
}

// A numbered form section: "01 / Personal details" + fields (1 column on phones, 2 from sm).
function Section({
  number,
  title,
  hint,
  className = "",
  children,
}: {
  number: string;
  title: string;
  hint: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      <div className="mb-4 border-b border-border pb-3">
        <h3 className="font-display text-headline-sm text-ink">
          <span className="tnum text-ink-faint">{number} /</span> {title}
        </h3>
        <p className="text-body-sm text-ink-muted">{hint}</p>
      </div>
      <FieldGrid>{children}</FieldGrid>
    </section>
  );
}

// One summary card on the phone review step, with an "Edit" pill.
function ReviewCard({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="font-display text-headline-sm text-ink">{title}</h4>
        <button type="button" onClick={onEdit} aria-label={`Edit ${title.toLowerCase()}`} className="group flex min-h-tap shrink-0 items-center">
          <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-sunken px-3.5 text-label-md text-ink group-hover:bg-surface-2">
            Edit
            <Pencil className="h-3.5 w-3.5" aria-hidden />
          </span>
        </button>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-label-sm text-ink-muted">{label}</p>
      <p className="text-body-md font-semibold text-ink wrap-anywhere">{value || "—"}</p>
    </div>
  );
}
