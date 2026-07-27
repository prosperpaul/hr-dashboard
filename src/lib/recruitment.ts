/*
  Shared recruitment constants and types. Pure (no server imports) so both
  server actions and client components can use them.
*/

export const JOB_STATUSES = ["Open", "On hold", "Closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Internship"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

// The pipeline an applicant moves through.
export const CANDIDATE_STAGES = [
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Hired",
  "Rejected",
] as const;
export type CandidateStage = (typeof CANDIDATE_STAGES)[number];

export type CandidateRow = {
  id: string;
  jobId: string;
  name: string;
  email: string | null;
  stage: string;
  notes: string | null;
};

export type JobRow = {
  id: string;
  title: string;
  departmentId: string | null;
  department: string; // resolved name, or "—"
  location: string | null;
  type: string;
  status: string;
  description: string | null;
  candidates: CandidateRow[];
};

export type JobInput = {
  title: string;
  departmentId: string | null;
  location: string;
  type: string;
  status: string;
  description: string;
};

export type CandidateInput = {
  jobId: string;
  name: string;
  email: string;
  stage: string;
  notes: string;
};
