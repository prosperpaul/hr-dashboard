import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

/*
  EmptyState — what a list shows when there's nothing in it: an icon, a
  short headline, one helpful sentence, and an optional action button.
*/
export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className = "",
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center px-4 py-10 text-center md:py-14 ${className}`}>
      <span className="grid size-tap place-items-center rounded-full bg-accent-soft text-accent-ink">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <p className="mt-4 text-headline-sm text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-body-md text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
