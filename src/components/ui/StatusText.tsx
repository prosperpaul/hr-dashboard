import { CheckCircle2, AlertTriangle, XCircle, Clock, Circle, type LucideIcon } from "lucide-react";

/*
  StatusText — a status shown with THREE cues, never colour alone:
  an icon shape, a colour, and the words themselves. So someone who
  can't tell green from red (or a printout in greyscale) still reads it.

    <StatusText tone="good">Approved</StatusText>
    <StatusText tone="warning">Pending</StatusText>
    <StatusText tone="critical">Rejected</StatusText>

  `variant="pill"` wraps it in a soft badge.
*/
export type StatusTone = "good" | "warning" | "critical" | "pending" | "neutral";

const TONES: Record<StatusTone, { icon: LucideIcon; text: string; pill: string }> = {
  good: { icon: CheckCircle2, text: "text-good", pill: "bg-good/10 border-good/25" },
  warning: { icon: AlertTriangle, text: "text-warning", pill: "bg-warning/10 border-warning/25" },
  critical: { icon: XCircle, text: "text-critical", pill: "bg-critical/10 border-critical/25" },
  pending: { icon: Clock, text: "text-accent-ink", pill: "bg-accent-soft border-accent/30" },
  neutral: { icon: Circle, text: "text-ink-muted", pill: "bg-surface-2 border-border" },
};

export default function StatusText({
  tone,
  children,
  variant = "text",
  icon,
  className = "",
}: {
  tone: StatusTone;
  children: React.ReactNode;
  variant?: "text" | "pill";
  icon?: LucideIcon; // override the default icon for this tone
  className?: string;
}) {
  const t = TONES[tone];
  const Icon = icon ?? t.icon;
  return (
    <span
      className={[
        "inline-flex min-w-0 max-w-full items-center gap-1.5 whitespace-nowrap text-label-md",
        t.text,
        variant === "pill" ? `rounded-full border px-2.5 py-1 ${t.pill}` : "",
        className,
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{children}</span>
    </span>
  );
}
