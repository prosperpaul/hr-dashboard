import { Construction } from "lucide-react";

/*
  A friendly placeholder for pages we haven't built yet,
  so menu links show this instead of a 404 error.
*/
export default function ComingSoon({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      </div>

      <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-surface/40 py-24 text-center">
        <div className="max-w-sm">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-accent-soft ring-1 ring-accent/40">
            <Construction className="h-6 w-6 text-accent" />
          </div>
          <p className="mt-4 text-sm font-medium text-ink">This page is coming soon</p>
          <p className="mt-1 text-sm text-ink-muted">
            We&apos;re building this feature. Check back shortly.
          </p>
        </div>
      </div>
    </div>
  );
}
