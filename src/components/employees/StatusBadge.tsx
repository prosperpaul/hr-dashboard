import type { EmployeeStatus } from "@/lib/sample-data";

// Pill with a coloured dot for an employee's status.
const styles: Record<EmployeeStatus, { dot: string; pill: string }> = {
  Active: { dot: "bg-accent", pill: "border-accent/25 bg-accent-soft text-accent-hover" },
  "On Leave": { dot: "bg-warning", pill: "border-warning/30 bg-warning/10 text-warning" },
  Remote: { dot: "bg-sky-400", pill: "border-sky-400/30 bg-sky-400/10 text-sky-300" },
};

export default function StatusBadge({ status }: { status: EmployeeStatus }) {
  const s = styles[status] ?? styles.Active;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-label-sm ${s.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}
