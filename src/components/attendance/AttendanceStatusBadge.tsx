// Small colored pill for an attendance status.
export default function AttendanceStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Present: "bg-good/15 text-good ring-good/40",
    Late: "bg-warning/15 text-warning ring-warning/40",
    Absent: "bg-critical/15 text-critical ring-critical/40",
    Remote: "bg-accent-soft text-accent ring-accent/40",
  };
  const cls = styles[status] ?? "bg-surface-2 text-ink-muted ring-border";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cls}`}>
      {status}
    </span>
  );
}
