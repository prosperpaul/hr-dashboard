/*
  Shared form pieces, so every form in the app looks and behaves the same.

  • `inputClass` — the standard text field / select. On phones/tablets it's a
    recessed "sunken" well (mobile design system); desktop keeps a bordered box. 48px tall on phones
    (an easy target), 44px from lg up. Phones also get 16px text from a
    rule in globals.css, which stops iOS zooming in when you tap a field.
  • <Field> — label ABOVE the control (never beside it, which gets cramped
    on a phone), an optional hint and an error message linked for screen
    readers.
  • <FieldGrid> — one column on phones, two from sm up.
  • <StickyActions> — keeps Save / Cancel visible at the bottom of a long
    form while you scroll; on phones it floats just above the tab bar.
  • <FormError> — an error that screen readers announce immediately.
*/
export const inputClass =
  "min-h-tap w-full min-w-0 rounded-lg border border-transparent bg-sunken px-3.5 focus:bg-surface lg:border-border lg:bg-surface text-body-md text-ink placeholder:text-ink-faint outline-none transition-colors hover:border-border-strong focus:border-ink focus:ring-1 focus:ring-ink disabled:opacity-60 lg:min-h-11";

export const textareaClass = inputClass.replace("min-h-tap", "min-h-24 py-3").replace(" lg:min-h-11", "");

export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  wide,
  children,
}: {
  label: string;
  htmlFor?: string; // id of the control, if it isn't a direct child
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  wide?: boolean; // span both columns in a FieldGrid
  children: React.ReactNode;
}) {
  const Tag = htmlFor ? "div" : "label";
  return (
    <Tag className={`block min-w-0 ${wide ? "sm:col-span-2" : ""}`}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="mb-1.5 block text-label-md text-ink">
          {label}
          {required && <span className="ml-0.5 text-critical" aria-hidden>*</span>}
        </label>
      ) : (
        <span className="mb-1.5 block text-label-md text-ink">
          {label}
          {required && <span className="ml-0.5 text-critical" aria-hidden>*</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-body-sm text-ink-faint">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1 block text-body-sm text-critical">
          {error}
        </span>
      )}
    </Tag>
  );
}

export function FieldGrid({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${className}`}>{children}</div>;
}

export function StickyActions({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={[
        "sticky bottom-tabbar-safe z-20 -mx-gutter mt-6 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface/95 px-gutter py-3 backdrop-blur",
        "md:-mx-8 md:px-8 lg:bottom-0",
        "[&>*]:flex-1 sm:[&>*]:flex-none",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-critical/40 bg-critical/10 px-3.5 py-2.5 text-body-sm text-critical">
      {children}
    </p>
  );
}
