export type Milestone = {
  id: string;
  name: string;
  years: number; // which anniversary (1, 2, 3…)
  when: string; // "Today" / "Tomorrow" / "Nov 16"
  soon: boolean; // within the next 2 days → highlighted
};

// "1st", "2nd", "3rd", "4th", "11th", "21st"…
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function Milestones({ items }: { items: Milestone[] }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-body-md text-ink-muted">No work anniversaries in the next 30 days.</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((m) => (
        <li key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 p-2.5">
          <span
            className={[
              "tnum w-[4.5rem] shrink-0 rounded-md px-2 py-1 text-center text-label-sm",
              m.soon ? "bg-accent-soft text-accent-hover" : "bg-bg text-ink-muted",
            ].join(" ")}
          >
            {m.when}
          </span>
          <div className="min-w-0">
            <p className="truncate text-label-md text-ink">{m.name}</p>
            <p className="truncate text-body-sm text-ink-faint">
              {ordinal(m.years)} work anniversary {m.years >= 5 ? "🏆" : "🎉"}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
