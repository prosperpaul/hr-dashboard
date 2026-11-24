/*
  PageHeader — the top of every page: a small eyebrow, the page's <h1>,
  an optional sentence, and action buttons.

  Phones: everything stacks, and the actions sit in a row under the
  title (they wrap if there are several). md and up: actions move to the
  right of the title.
*/
export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className = "",
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={`mb-6 flex min-w-0 flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between ${className}`}>
      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 text-eyebrow uppercase text-accent-ink">{eyebrow}</p>}
        <h1 className="text-headline-lg text-ink [overflow-wrap:anywhere] md:text-headline-xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-body-lg text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-2 md:shrink-0 md:justify-end">{actions}</div>}
    </header>
  );
}
