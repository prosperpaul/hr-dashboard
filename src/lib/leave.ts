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
};

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
