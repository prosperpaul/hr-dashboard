/*
  A titled container card (Level 1 surface: #111315 + 1px hairline border).
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
      className={`rounded-xl border border-border bg-surface p-5 transition-colors duration-150 hover:border-border-strong ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
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
  dot?: boolean; // glowing status orb
}) {
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-label-sm",
        tone === "accent"
          ? "border-accent/25 bg-accent-soft text-accent-hover"
          : "border-border bg-white/[0.04] text-ink-muted",
      ].join(" ")}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />}
      {children}
    </span>
  );
}
