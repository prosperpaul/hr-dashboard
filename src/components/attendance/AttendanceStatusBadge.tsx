import { House, type LucideIcon } from "lucide-react";
import StatusText, { type StatusTone } from "@/components/ui/StatusText";

// Pill for an attendance status, with a small coloured dot.
// "No record" = the person hasn't clocked in that day.
// Colours follow the design system: on time = sky, late = butter,
// remote = lilac, absent = rose.
const STYLES: Record<string, { pill: string; dot: string; label?: string }> = {
  Present: { pill: "bg-tint-sky text-ink", dot: "bg-sky-300", label: "On time" },
  Late: { pill: "bg-accent-soft text-accent-ink", dot: "bg-accent" },
  Remote: { pill: "bg-tint-lilac text-ink", dot: "bg-violet-300" },
  Absent: { pill: "bg-tint-rose text-critical", dot: "bg-critical" },
  "No record": { pill: "bg-surface-2 text-ink-muted", dot: "bg-ink-faint", label: "Not checked in" },
};

export const attendanceDot = (status: string) => STYLES[status]?.dot ?? "bg-ink-faint";

// The friendly name for a status ("Present" shows as "On time").
export const attendanceLabel = (status: string) => STYLES[status]?.label ?? status;

export default function AttendanceStatusBadge({ status, note }: { status: string; note?: string }) {
  const s = STYLES[status] ?? { pill: "bg-surface-2 text-ink-muted", dot: "bg-ink-faint" };
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-label-sm font-semibold ${s.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      {s.label ?? status}
      {note && <span className="tnum opacity-80">({note})</span>}
    </span>
  );
}

// The same statuses as icon + colour + words (via StatusText), for phone
// rows where a status must never be shown by colour alone.
const TONE: Record<string, { tone: StatusTone; icon?: LucideIcon }> = {
  Present: { tone: "good" },
  Late: { tone: "pending" },
  Remote: { tone: "neutral", icon: House },
  Absent: { tone: "critical" },
  "No record": { tone: "neutral" },
};

export function AttendanceStatusText({ status, note, variant = "text" }: { status: string; note?: string; variant?: "text" | "pill" }) {
  const t = TONE[status] ?? { tone: "neutral" as const };
  return (
    <StatusText tone={t.tone} icon={t.icon} variant={variant}>
      {attendanceLabel(status)}
      {note && <span className="tnum opacity-80"> ({note})</span>}
    </StatusText>
  );
}
