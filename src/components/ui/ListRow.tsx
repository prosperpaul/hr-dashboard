import Link from "next/link";
import { ChevronRight } from "lucide-react";

/*
  ListRow — the standard phone list item.

    [leading]  Title                         [meta]
               subtitle                      [trailing]

  • At least 48px tall (min-h-tap), so the whole row is an easy target.
  • Give it `href` to make the entire row a link (adds a chevron), or
    `onClick` to make it a button. Otherwise it's plain content and any
    buttons you pass in `trailing` stay separately tappable.
  • min-w-0 + truncate stop long names from widening the page.
*/
export default function ListRow({
  leading,
  title,
  subtitle,
  meta,
  trailing,
  href,
  onClick,
  className = "",
  label,
}: {
  leading?: React.ReactNode; // avatar or icon
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  meta?: React.ReactNode; // small right-aligned info, e.g. a date or amount
  trailing?: React.ReactNode; // status / buttons under the meta
  href?: string;
  onClick?: () => void;
  className?: string;
  label?: string; // accessible name when the row is a link/button
}) {
  const body = (
    <>
      {leading && <span className="shrink-0">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-lg font-semibold text-ink">{title}</span>
        {subtitle && <span className="mt-0.5 block truncate text-body-sm text-ink-muted">{subtitle}</span>}
      </span>
      {(meta || trailing) && (
        <span className="flex max-w-[45%] shrink-0 flex-col items-end gap-1 text-right">
          {meta && <span className="tnum truncate text-body-sm text-ink">{meta}</span>}
          {trailing}
        </span>
      )}
      {(href || onClick) && <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" aria-hidden />}
    </>
  );

  const cls = `flex min-h-tap w-full min-w-0 items-center gap-3 py-3 text-left ${className}`;

  if (href) {
    return (
      <Link href={href} aria-label={label} className={`${cls} transition-colors active:bg-surface-2`}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={label} className={`${cls} transition-colors active:bg-surface-2`}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}
