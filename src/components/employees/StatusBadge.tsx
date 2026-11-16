import type { EmployeeStatus } from "@/lib/sample-data";

/*
  An employee's status, editorial style: a small coloured dot + the word.
  - "dot" variant (default): plain dot + text, used in tables and card footers.
  - "pill" variant: the same inside a soft rounded chip (headers, previews).
*/
const styles: Record<EmployeeStatus, { dot: string; pill: string }> = {
  Active: { dot: "bg-good", pill: "bg-good/10 text-good" },
  "On Leave": { dot: "bg-warning", pill: "bg-warning/10 text-warning" },
  Remote: { dot: "bg-sky-300", pill: "bg-sky-300/10 text-sky-300" },
};

// The dot colour on its own (handy for avatars / custom layouts).
export const statusDot = (status: string) => styles[status as EmployeeStatus]?.dot ?? "bg-ink-faint";

export default function StatusBadge({ status, variant = "dot" }: { status: EmployeeStatus; variant?: "dot" | "pill" }) {
  const s = styles[status] ?? styles.Active;
  if (variant === "pill") {
    return (
      <span className={`inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-label-sm ${s.pill}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
        {status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-body-sm font-medium text-ink">
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}
