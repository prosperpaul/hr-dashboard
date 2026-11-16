"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, X } from "lucide-react";
import { employeeStatuses, type Employee } from "@/lib/sample-data";
import type { EmployeeInput } from "@/lib/employee-actions";
import type { DeptOption } from "./EmployeesManager";
import EmployeeAvatar from "./EmployeeAvatar";
import StatusBadge from "./StatusBadge";
import { formatDate } from "./employee-format";

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

export default function EmployeeFormModal({
  open,
  editing,
  departments,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: Employee | null; // an employee when editing, null when adding
  departments: DeptOption[];
  onClose: () => void;
  onSave: (data: EmployeeInput, id?: string) => void;
}) {
  // The form's current field values.
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

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
    }
  }

  // Close the dialog when the Escape key is pressed.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // A small helper to update one field of the form.
  function update(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Basic validation — make sure required fields are filled.
    if (!form.name.trim() || !form.email.trim() || !form.role.trim()) {
      setError("Please fill in name, email, and role.");
      return;
    }

    // Parse the allowance; must be a whole number 0 or more.
    const allowance = Number(form.leaveAllowance);
    if (!Number.isInteger(allowance) || allowance < 0) {
      setError("Leave allowance must be a whole number of days (0 or more).");
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

  // Soft-filled fields with a navy focus ring, like the mockup's form.
  const inputClass =
    "h-11 w-full rounded-lg border border-transparent bg-bg px-3.5 text-body-md text-ink placeholder:text-ink-faint outline-none transition-colors hover:border-border focus:border-ink focus:bg-surface focus:ring-1 focus:ring-ink";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      {/* Navy scrim — clicking it closes the dialog */}
      <div className="absolute inset-0 bg-navy/45" onClick={onClose} />

      {/* The dialog itself */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="employee-form-title"
        className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-xl border border-border bg-surface shadow-modal sm:rounded-xl"
      >
        {/* Header: eyebrow + editorial headline */}
        <div className="flex items-start justify-between gap-4 border-b border-border bg-bg px-5 py-5 sm:px-8">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-accent-ink">
              {editing ? "Employee record · Edit" : "Employee onboarding"}
            </p>
            <h2 id="employee-form-title" className="text-headline-md text-ink sm:text-headline-lg">
              {editing ? `Update ${editing.name.split(" ")[0]}'s details.` : "Let's welcome a new teammate."}
            </h2>
            <p className="text-body-md text-ink-muted">
              {editing ? "Changes apply everywhere this person appears." : "Set up their identity, job details and time-off allowance."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-surface text-ink-muted transition-colors hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[1fr_320px]">
            {/* ── Left: the form, in numbered sections ── */}
            <div className="space-y-8 px-5 py-6 sm:px-8">
              <Section number="01" title="Personal details" hint="Who they are and how to reach them.">
                <Field label="Full name" required>
                  <input className={inputClass} value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Jane Doe" autoFocus />
                </Field>
                <Field label="Work email" required>
                  <input type="email" className={inputClass} value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="jane.doe@company.com" />
                </Field>
              </Section>

              <Section number="02" title="Job & department" hint="Where they sit and when they start.">
                <Field label="Job title / role" required wide>
                  <input className={inputClass} value={form.role} onChange={(e) => update("role", e.target.value)} placeholder="e.g. Product Designer" />
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
                  <input type="date" className={inputClass} value={form.startedAt} onChange={(e) => update("startedAt", e.target.value)} />
                </Field>
              </Section>

              <Section number="03" title="Time off" hint="Paid days per year (vacation + personal leave count against it).">
                <Field label="Leave allowance (days / yr)">
                  <input type="number" min={0} step={1} className={`${inputClass} tnum`} value={form.leaveAllowance} onChange={(e) => update("leaveAllowance", e.target.value)} />
                </Field>
              </Section>

              {error && (
                <p role="alert" className="rounded-lg border border-critical/30 bg-critical/10 px-3.5 py-2.5 text-body-sm text-critical">
                  {error}
                </p>
              )}
            </div>

            {/* ── Right: live preview of the welcome card (desktop only) ── */}
            <aside className="hidden border-l border-border bg-bg px-6 py-6 lg:block">
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink">Live preview</p>
              <p className="mb-4 text-body-sm text-ink-muted">How they&apos;ll appear in the directory.</p>
              <div className="rounded-xl border border-navy-line bg-navy p-5 text-on-navy">
                <span className="inline-flex h-6 items-center rounded-full bg-accent px-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-on-accent">
                  {editing ? "Team member" : "Welcome to the team"}
                </span>
                <div className="mt-4 flex items-center gap-3">
                  <EmployeeAvatar name={previewName} department={deptName} size="sm" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-on-navy-muted">{editing ? "Employee" : "New hire"}</p>
                    <p className="truncate font-display text-headline-sm">{previewName}</p>
                    <p className="truncate text-body-sm text-on-navy-muted">{form.role.trim() || "Role to be set"}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <span className="inline-flex h-6 items-center rounded-full border border-navy-line bg-navy-2 px-2.5 text-[11px] font-bold uppercase tracking-[0.06em]">
                    {deptName ?? "Unassigned"}
                  </span>
                  <span className="inline-flex h-6 items-center rounded-full border border-navy-line bg-navy-2 px-2.5 text-[11px] font-bold uppercase tracking-[0.06em]">
                    {form.leaveAllowance || 0} days leave
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between rounded-lg bg-navy-2 px-3 py-2.5 text-body-sm">
                  <span className="inline-flex items-center gap-2 font-semibold">
                    <CalendarDays className="h-4 w-4 text-[#f5c518]" />
                    Starting date
                  </span>
                  <span className="tnum font-semibold text-[#f5c518]">{form.startedAt ? formatDate(form.startedAt) : "Today"}</span>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-4 py-3">
                <span className="truncate text-body-sm text-ink-muted">{form.email.trim() || "email@company.com"}</span>
                <StatusBadge status={form.status} variant="pill" />
              </div>
            </aside>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-2 border-t border-border bg-surface px-5 py-4 sm:px-8">
            <button type="button" onClick={onClose} className="h-10 rounded-full border border-border bg-surface px-5 text-label-md text-ink transition-colors hover:bg-bg">
              Cancel
            </button>
            <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-label-md text-on-accent transition-colors hover:bg-accent-hover active:bg-accent-pressed">
              {editing ? "Save changes" : "Add employee"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// A numbered form section: "01 / Personal details" + a 2-column field grid.
function Section({ number, title, hint, children }: { number: string; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4 border-b border-border pb-3">
        <h3 className="font-display text-headline-sm text-ink">
          <span className="tnum text-ink-faint">{number} /</span> {title}
        </h3>
        <p className="text-body-sm text-ink-muted">{hint}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

// A small label + input wrapper, reused for each field.
function Field({ label, required, wide, hint, children }: { label: string; required?: boolean; wide?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className={`block ${wide ? "sm:col-span-2" : ""}`}>
      <span className="mb-1.5 block text-label-md text-ink">
        {label}
        {required && <span className="ml-0.5 text-critical">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-body-sm text-ink-faint">{hint}</span>}
    </label>
  );
}
