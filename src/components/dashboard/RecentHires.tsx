export type RecentHire = {
  id: string;
  name: string;
  role: string;
  department: string;
  startedAt: string; // human-friendly, e.g. "2 days ago"
  initials: string;
};

export default function RecentHires({ hires }: { hires: RecentHire[] }) {
  if (hires.length === 0) {
    return <p className="py-6 text-center text-sm text-ink-muted">No employees yet.</p>;
  }
  return (
    <ul className="space-y-1">
      {hires.map((hire) => (
        <li
          key={hire.id}
          className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-surface-2"
        >
          {/* Avatar with initials */}
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-chart-2 text-xs font-semibold text-white">
            {hire.initials}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{hire.name}</p>
            <p className="truncate text-xs text-ink-muted">{hire.role}</p>
          </div>

          <div className="hidden text-right sm:block">
            <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-ink-muted">
              {hire.department}
            </span>
            <p className="mt-1 text-[11px] text-ink-faint">{hire.startedAt}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
