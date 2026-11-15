// Pill for an attendance status, with a small coloured dot.
// "No record" = the person hasn't clocked in that day.
const STYLES: Record<string, { pill: string; dot: string; label?: string }> = {
  Present: { pill: "border-accent/25 bg-accent-soft text-accent-hover", dot: "bg-accent", label: "On time" },
  Late: { pill: "border-warning/30 bg-warning/10 text-warning", dot: "bg-warning" },
  Remote: { pill: "border-indigo-400/30 bg-indigo-400/10 text-indigo-300", dot: "bg-indigo-400" },
  Absent: { pill: "border-critical/30 bg-critical/10 text-critical", dot: "bg-critical" },
  "No record": { pill: "border-border bg-white/[0.04] text-ink-faint", dot: "bg-ink-faint", label: "Not checked in" },
};

export const attendanceDot = (status: string) => STYLES[status]?.dot ?? "bg-ink-faint";

export default function AttendanceStatusBadge({ status, note }: { status: string; note?: string }) {
  const s = STYLES[status] ?? { pill: "border-border bg-surface-2 text-ink-muted", dot: "bg-ink-faint" };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-label-sm ${s.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label ?? status}
      {note && <span className="opacity-80">({note})</span>}
    </span>
  );
}
