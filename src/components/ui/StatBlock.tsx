/*
  StatBlock — one headline number with its label (and an optional hint).

  StatStrip lays several out:
  • Phones: a sideways-swipeable row that snaps card by card (only the strip
    scrolls, never the page). Each card is ~70% of the screen wide, so the
    next one peeks in and shows there's more.
  • md and up: a normal grid of 2–4 columns.
*/
export function StatBlock({
  label,
  value,
  hint,
  icon,
  tone = "default",
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "navy" | "accent";
  className?: string;
}) {
  const tones = {
    default: "border-border bg-surface text-ink",
    navy: "border-navy bg-navy text-on-navy",
    accent: "border-accent bg-accent text-on-accent",
  } as const;
  const muted = tone === "default" ? "text-ink-muted" : tone === "navy" ? "text-on-navy-muted" : "text-on-accent/75";

  return (
    <div className={`flex min-w-0 flex-col rounded-xl border p-4 md:p-5 ${tones[tone]} ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p className={`truncate text-eyebrow uppercase ${muted}`}>{label}</p>
        {icon && <span className={`shrink-0 ${muted}`}>{icon}</span>}
      </div>
      <p className="tnum mt-3 truncate text-metric-md md:text-metric-lg">{value}</p>
      {hint && <p className={`mt-1 text-body-sm ${muted}`}>{hint}</p>}
    </div>
  );
}

export function StatStrip({
  children,
  label,
  cols = 4,
  className = "",
}: {
  children: React.ReactNode;
  label: string; // names the group for screen readers
  cols?: 2 | 3 | 4;
  className?: string;
}) {
  const grid = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "md:grid-cols-2 xl:grid-cols-4" }[cols];
  return (
    <div
      role="group"
      aria-label={label}
      className={[
        // phones: swipe strip that bleeds to the screen edges
        "-mx-gutter flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-gutter pb-1 [scrollbar-width:none]",
        "[&>*]:w-[70%] [&>*]:max-w-72 [&>*]:shrink-0 [&>*]:snap-start",
        // md+: grid, no swiping
        `md:mx-0 md:grid md:overflow-visible md:px-0 md:pb-0 md:[&>*]:w-auto md:[&>*]:max-w-none ${grid}`,
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
