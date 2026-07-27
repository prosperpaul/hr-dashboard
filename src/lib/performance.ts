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
};

// Fields the form submits when creating/editing a review.
export type ReviewInput = {
  employeeId: string;
  period: string;
  rating: number;
  strengths: string;
  goals: string;
};
