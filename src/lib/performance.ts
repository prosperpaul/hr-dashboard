/*
  Shared performance-review constants, types, and helpers. Pure (no server
  imports) so both server actions and client components can use them.
*/

export const REVIEW_STATUSES = ["Draft", "Submitted", "Acknowledged"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

// Human labels for the 1..5 overall rating.
export const RATING_LABELS: Record<number, string> = {
  1: "Needs improvement",
  2: "Developing",
  3: "Meets expectations",
  4: "Exceeds expectations",
  5: "Outstanding",
};

export function ratingLabel(rating: number): string {
  return RATING_LABELS[rating] ?? "—";
}

// A review shaped for the UI (employee name resolved via the relation).
export type ReviewRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  reviewerName: string;
  period: string;
  rating: number;
  strengths: string | null;
  goals: string | null;
  status: string;
  updatedAt: string; // ISO — last edit or status change
};

// An employee as the Performance page needs them.
export type PerfEmployee = { id: string; name: string; role: string; department: string | null };

/*
  Sort key for cycle names like "Q2 2026" or "H1 2026" so they order in time:
  year first, then the part of the year (Q1/H1 early … Q4/H2 late).
*/
export function periodSortKey(period: string): number {
  const year = Number(period.match(/\d{4}/)?.[0] ?? 0);
  const part = /Q1/i.test(period) ? 1 : /Q2|H1/i.test(period) ? 2 : /Q3/i.test(period) ? 3 : /Q4|H2/i.test(period) ? 4 : 0;
  return year * 10 + part;
}

// Fields the form submits when creating/editing a review.
export type ReviewInput = {
  employeeId: string;
  period: string;
  rating: number;
  strengths: string;
  goals: string;
};
