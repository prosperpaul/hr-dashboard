"use client";

/*
  Two kinds of "pick one" controls from the mobile design system:

  • <ChipTabs> — filter chips in a sideways-swipeable row (Pending 4 ·
    Approved 18 · Declined 2). The chosen chip is solid navy; the others are
    white with a hairline border. Each chip LOOKS 36px tall but its tap area
    is the full 48px (the button is taller than the visible pill).

  • <Segmented> — a sunken track holding 2–3 options, the chosen one shown
    as a white pill (Requests | Calendar, Pipeline | Interviews | Roles).
    It stretches to the full width on phones.

  Both use aria-pressed so screen readers announce which one is selected,
  and the count is part of the label ("Pending, 4").
*/
export type ChipOption = { key: string; label: string; count?: number; icon?: React.ReactNode };

export function ChipTabs({
  options,
  value,
  onChange,
  label,
  className = "",
}: {
  options: ChipOption[];
  value: string;
  onChange: (key: string) => void;
  label: string; // names the group, e.g. "Filter by status"
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`-mx-gutter flex gap-2 overflow-x-auto overscroll-x-contain px-gutter [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0 ${className}`}
    >
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.key)}
            className="group flex min-h-tap shrink-0 items-center lg:min-h-0"
          >
            <span
              className={[
                "inline-flex h-9 items-center gap-2 rounded-full border px-4 text-label-md transition-colors",
                on ? "border-navy bg-navy text-on-navy" : "border-border bg-surface text-ink-muted group-hover:text-ink",
              ].join(" ")}
            >
              {o.icon}
              {o.label}
              {o.count !== undefined && (
                <span
                  className={`tnum grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-label-sm ${
                    on ? "bg-accent text-on-accent" : "bg-sunken text-ink-muted"
                  }`}
                >
                  {o.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function Segmented({
  options,
  value,
  onChange,
  label,
  className = "",
}: {
  options: ChipOption[];
  value: string;
  onChange: (key: string) => void;
  label: string;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`flex w-full gap-1 rounded-full bg-sunken p-1 md:w-auto md:inline-flex ${className}`}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.key)}
            className={[
              "inline-flex min-h-tap flex-1 items-center justify-center gap-2 rounded-full px-4 text-label-md transition-colors lg:min-h-10 md:flex-none",
              on ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-border)]" : "text-ink-muted hover:text-ink",
            ].join(" ")}
          >
            {o.icon}
            {o.label}
            {o.count !== undefined && (
              <span className={`tnum grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-label-sm ${on ? "bg-accent text-on-accent" : "bg-surface text-ink-muted"}`}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
