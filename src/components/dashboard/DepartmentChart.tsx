export type DeptPoint = { department: string; employees: number };

// Segment colours: emerald first (largest team), then lighter/greyer tones so
// the accent never floods the card. The last one is used for "Other".
// (CSS variables, so they switch with light/dark mode.)
const COLORS = ["var(--color-accent)", "var(--color-chart-mint)", "var(--color-chart-sage)", "var(--color-border-strong)"];

/*
  Donut chart + legend, drawn with plain SVG (no chart library needed).

  How the donut works: each department is a circle with a thick stroke.
  `stroke-dasharray="len gap"` draws only `len` of the circle's outline,
  and `stroke-dashoffset` rotates where it starts — so we lay segments
  end to end around the ring.
*/
export default function DepartmentChart({ data, total }: { data: DeptPoint[]; total: number }) {
  if (data.length === 0 || total === 0) {
    return <p className="py-8 text-center text-body-md text-ink-muted">No departments yet.</p>;
  }

  // More than 4 departments? Show the top 3 and fold the rest into "Other".
  const rows =
    data.length > 4
      ? [
          ...data.slice(0, 3),
          { department: "Other", employees: data.slice(3).reduce((s, d) => s + d.employees, 0) },
        ]
      : data;

  const R = 62;
  const C = 2 * Math.PI * R; // circumference
  const GAP = rows.length > 1 ? 3 : 0; // tiny gap between segments
  // Each segment's length, then where it starts = sum of the ones before it.
  const lengths = rows.map((row) => (row.employees / total) * C);
  const segments = lengths.map((len, i) => ({
    color: COLORS[i],
    dash: `${Math.max(len - GAP, 0)} ${C}`,
    offset: -lengths.slice(0, i).reduce((sum, l) => sum + l, 0),
  }));

  return (
    <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-12">
      {/* Donut */}
      <div className="flex justify-center md:col-span-5">
        <div className="relative h-44 w-44">
          <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90" aria-hidden>
            <circle cx="80" cy="80" r={R} fill="none" stroke="var(--color-surface-2)" strokeWidth="14" />
            {segments.map((s, i) => (
              <circle
                key={i}
                cx="80"
                cy="80"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth="14"
                strokeDasharray={s.dash}
                strokeDashoffset={s.offset}
              />
            ))}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="tnum text-metric-md text-ink">{total}</span>
            <span className="text-label-sm uppercase tracking-wider text-ink-faint">Headcount</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <ul className="space-y-2 md:col-span-7">
        {rows.map((row, i) => (
          <li
            key={row.department}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg/50 px-3 py-2"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[i] }} />
              <span className="truncate text-label-md text-ink">{row.department}</span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="tnum text-body-sm text-ink-faint">
                {row.employees} {row.employees === 1 ? "person" : "people"}
              </span>
              <span className={`tnum w-10 text-right text-label-sm ${i === 0 ? "text-accent-hover" : "text-ink-muted"}`}>
                {Math.round((row.employees / total) * 100)}%
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
