/*
  A titled content card (white surface + 1px hairline, 6px corners).
  The header is separated from the body by a hairline rule, like a print column.
  `title`/`subtitle` show at the top, `action` is an optional element on the
  right (e.g. a link), and `children` is whatever goes inside.
*/
export default function Panel({
  id,
  title,
  subtitle,
  badge,
  action,
  children,
  className = "",
}: {
  id?: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode; // small pill shown right after the title
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={`rounded-xl border border-border bg-surface p-5 md:p-6 ${className}`}
    >
      <div className="-mx-5 mb-5 flex items-start justify-between gap-3 border-b border-border px-5 pb-4 md:-mx-6 md:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-headline-sm text-ink">{title}</h2>
            {badge}
          </div>
          {subtitle && <p className="mt-0.5 text-body-sm text-ink-faint">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// Small pill used next to panel titles and inside cards.
export function Pill({
  children,
  tone = "neutral",
  dot = false,
}: {
  children: React.ReactNode;
  tone?: "accent" | "neutral";
  dot?: boolean; // small status dot
}) {
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-label-sm",
        tone === "accent"
          ? "border-transparent bg-accent-soft text-accent-ink"
          : "border-border bg-surface-2 text-ink-muted",
      ].join(" ")}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
      {children}
    </span>
  );
}
