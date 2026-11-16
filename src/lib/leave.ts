/*
  Shared leave constants, types, and helpers. Pure (no server imports) so both
  the server actions and the client components can use them. This lives apart
  from leave-actions.ts because a "use server" file may only export functions.
*/

export const LEAVE_TYPES = ["Vacation", "Sick", "Personal", "Unpaid"] as const;
export type LeaveType = (typeof LEAVE_TYPES)[number];

export const LEAVE_STATUSES = ["Pending", "Approved", "Rejected"] as const;
export type LeaveStatus = (typeof LEAVE_STATUSES)[number];

// A leave request shaped for the UI (employee name resolved via the relation).
export type LeaveRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string | null;
  status: string;
  department: string | null; // the employee's department name
  createdAt: string; // ISO timestamp the request was submitted
};

// An employee as the Leave page needs them (for balances & the request form).
export type LeaveEmployee = {
  id: string;
  name: string;
  email: string;
  department: string | null;
  leaveAllowance: number; // paid days per year
};

/*
  One colour per leave type, used by the timeline bars, legend, queue badges
  and table. Kept here so every part of the page agrees. They use the soft
  "tint" colours from the design system (always with navy text):
  Vacation = sky, Sick = rose, Personal = lilac, Unpaid = sand.
  `dot` is a small swatch (legend / dots), `chip` styles a pill or bar.
  (Full class names are written out so Tailwind can find them.)
*/
export const LEAVE_TYPE_STYLES: Record<string, { dot: string; chip: string }> = {
  Vacation: { dot: "bg-tint-sky ring-1 ring-inset ring-ink/20", chip: "border-ink/15 bg-tint-sky text-ink" },
  Sick: { dot: "bg-tint-rose ring-1 ring-inset ring-ink/20", chip: "border-ink/15 bg-tint-rose text-ink" },
  Personal: { dot: "bg-tint-lilac ring-1 ring-inset ring-ink/20", chip: "border-ink/15 bg-tint-lilac text-ink" },
  Unpaid: { dot: "bg-tint-sand ring-1 ring-inset ring-ink/20", chip: "border-ink/15 bg-tint-sand text-ink" },
};
export const leaveStyle = (type: string) =>
  LEAVE_TYPE_STYLES[type] ?? { dot: "bg-surface-2 ring-1 ring-inset ring-ink/20", chip: "border-border bg-surface-2 text-ink-muted" };

// "Nov 18", "Nov 18–22", "Nov 28 – Dec 2" (dates are local "YYYY-MM-DD").
export function formatLeaveRange(start: string, end: string): string {
  const parse = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1);
  };
  const a = parse(start);
  const b = parse(end);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return `${start} – ${end}`;
  const short = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (start === end) return short(a);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return `${short(a)}–${b.getDate()}`;
  return `${short(a)} – ${short(b)}`;
}

// Fields the form submits when creating a request.
export type LeaveInput = {
  employeeId: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
};

// Inclusive day count between two ISO dates ("Aug 3".."Aug 7" = 5 days).
// Returns 0 for an invalid/backwards range so callers can validate.
export function dayCount(start: string, end: string): number {
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (isNaN(s) || isNaN(e) || e < s) return 0;
  return Math.round((e - s) / 86_400_000) + 1;
}

// Which leave types count against the annual paid-leave allowance.
// Sick and Unpaid do NOT reduce it.
export const ALLOWANCE_TYPES: readonly string[] = ["Vacation", "Personal"];

// A minimal row shape for balance math (works with LeaveRow or DB records).
type LeaveLike = { type: string; status: string; startDate: string; days: number };

/*
  Sum the APPROVED, allowance-counting leave days that START in the given year.
  This is the "used" figure; remaining = allowance - used.
*/
export function usedAllowanceDays(rows: LeaveLike[], year = new Date().getFullYear()): number {
  return rows.reduce((sum, r) => {
    const startsThisYear = new Date(r.startDate).getFullYear() === year;
    if (r.status === "Approved" && ALLOWANCE_TYPES.includes(r.type) && startsThisYear) {
      return sum + r.days;
    }
    return sum;
  }, 0);
}
