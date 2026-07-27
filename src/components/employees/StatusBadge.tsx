import type { EmployeeStatus } from "@/lib/sample-data";

// Maps each status to its dot color + text color classes.
const styles: Record<EmployeeStatus, { dot: string; text: string; bg: string }> = {
  Active: { dot: "bg-good", text: "text-good", bg: "bg-good/10" },
  "On Leave": { dot: "bg-warning", text: "text-warning", bg: "bg-warning/10" },
  Remote: { dot: "bg-accent", text: "text-accent", bg: "bg-accent/10" },
};

export default function StatusBadge({ status }: { status: EmployeeStatus }) {
  const s = styles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}
