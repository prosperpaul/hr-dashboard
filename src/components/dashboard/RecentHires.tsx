export type RecentHire = {
  id: string;
  name: string;
  role: string;
  department: string;
  startedAt: string; // human-friendly, e.g. "3d ago"
  initials: string;
};

export default function RecentHires({ hires }: { hires: RecentHire[] }) {
  if (hires.length === 0) {
    return <p className="py-6 text-center text-body-md text-ink-muted">No employees yet.</p>;
  }
  return (
    <ul className="divide-y divide-border">
      {hires.map((hire) => (
        <li key={hire.id} className="group flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* Avatar with initials */}
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-label-sm font-semibold text-accent-hover">
              {hire.initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-label-md text-ink transition-colors group-hover:text-accent-hover">{hire.name}</p>
              <p className="truncate text-body-sm text-ink-faint">{hire.role}</p>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <span className="mb-0.5 block rounded-md border border-border bg-surface-2 px-2 py-0.5 text-label-sm text-ink-muted">
              {hire.department}
            </span>
            <span className="tnum text-body-sm text-ink-faint">{hire.startedAt}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
