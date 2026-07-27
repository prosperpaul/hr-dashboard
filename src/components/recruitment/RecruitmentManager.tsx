"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Briefcase, MapPin, Users } from "lucide-react";
import {
  CANDIDATE_STAGES,
  type JobRow,
  type JobInput,
  type CandidateInput,
} from "@/lib/recruitment";
import {
  createJob,
  updateJob,
  deleteJob,
  createCandidate,
  setCandidateStage,
  deleteCandidate,
} from "@/lib/recruitment-actions";
import JobFormModal from "./JobFormModal";
import CandidateFormModal from "./CandidateFormModal";

type DeptOption = { id: string; name: string };

function JobStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Open: "bg-good/15 text-good ring-good/40",
    "On hold": "bg-warning/15 text-warning ring-warning/40",
    Closed: "bg-surface-2 text-ink-muted ring-border",
  };
  const cls = styles[status] ?? "bg-surface-2 text-ink-muted ring-border";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cls}`}>
      {status}
    </span>
  );
}

export default function RecruitmentManager({
  jobs,
  departments,
}: {
  jobs: JobRow[];
  departments: DeptOption[];
}) {
  const router = useRouter();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(jobs[0]?.id ?? null);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobRow | null>(null);
  const [candidateModalOpen, setCandidateModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Fall back to the first job if the selected one is gone (e.g. deleted).
  const selectedJob = jobs.find((j) => j.id === selectedJobId) ?? jobs[0] ?? null;

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      try {
        await fn();
        router.refresh(); // re-fetch fresh server data (real ids, counts)
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  function handleSaveJob(data: JobInput, id?: string) {
    run(async () => {
      if (id) await updateJob(id, data);
      else await createJob(data);
      setJobModalOpen(false);
    });
  }

  function handleDeleteJob(job: JobRow) {
    const msg =
      job.candidates.length > 0
        ? `Delete "${job.title}" and its ${job.candidates.length} candidate(s)?`
        : `Delete "${job.title}"?`;
    if (!window.confirm(msg)) return;
    run(() => deleteJob(job.id));
  }

  function handleAddCandidate(data: CandidateInput) {
    run(async () => {
      await createCandidate(data);
      setCandidateModalOpen(false);
    });
  }

  function handleStage(candidateId: string, stage: string) {
    run(() => setCandidateStage(candidateId, stage));
  }

  function handleDeleteCandidate(id: string, name: string) {
    if (!window.confirm(`Remove ${name} from this pipeline?`)) return;
    run(() => deleteCandidate(id));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Recruitment</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {isPending ? "Working…" : `${jobs.length} open role${jobs.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          onClick={() => {
            setEditingJob(null);
            setJobModalOpen(true);
          }}
          disabled={isPending}
          className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          New job
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Jobs list */}
        <div className="space-y-3">
          {jobs.map((job) => {
            const active = job.id === selectedJob?.id;
            return (
              <button
                key={job.id}
                onClick={() => setSelectedJobId(job.id)}
                className={[
                  "group w-full rounded-2xl border bg-surface p-4 text-left transition-colors",
                  active ? "border-accent/60 ring-1 ring-accent/40" : "border-border hover:border-accent/40",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-ink">{job.title}</p>
                  <JobStatusBadge status={job.status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                  <span className="inline-flex items-center gap-1">
                    <Briefcase className="h-3.5 w-3.5 text-ink-faint" />
                    {job.department} · {job.type}
                  </span>
                  {job.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-ink-faint" />
                      {job.location}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
                    <Users className="h-3.5 w-3.5 text-ink-faint" />
                    {job.candidates.length} candidate{job.candidates.length === 1 ? "" : "s"}
                  </span>
                  <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingJob(job);
                        setJobModalOpen(true);
                      }}
                      aria-label={`Edit ${job.title}`}
                      className="grid h-7 w-7 place-items-center rounded-md text-ink-faint hover:bg-surface-2 hover:text-accent"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteJob(job);
                      }}
                      aria-label={`Delete ${job.title}`}
                      className="grid h-7 w-7 place-items-center rounded-md text-ink-faint hover:bg-surface-2 hover:text-critical"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  </span>
                </div>
              </button>
            );
          })}

          {jobs.length === 0 && (
            <div className="rounded-2xl border border-border bg-surface p-8 text-center">
              <p className="text-sm font-medium text-ink">No jobs yet</p>
              <p className="mt-1 text-sm text-ink-muted">Create your first opening.</p>
            </div>
          )}
        </div>

        {/* Candidates for the selected job */}
        <div className="rounded-2xl border border-border bg-surface">
          {selectedJob ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
                <div>
                  <h2 className="text-base font-semibold text-ink">{selectedJob.title}</h2>
                  <p className="text-xs text-ink-muted">
                    {selectedJob.department} · {selectedJob.type}
                    {selectedJob.location ? ` · ${selectedJob.location}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => setCandidateModalOpen(true)}
                  disabled={isPending}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-2 disabled:opacity-60"
                >
                  <Plus className="h-4 w-4" />
                  Add candidate
                </button>
              </div>

              {/* Pipeline stage counts */}
              <div className="flex flex-wrap gap-2 border-b border-border p-4">
                {CANDIDATE_STAGES.map((stage) => {
                  const n = selectedJob.candidates.filter((c) => c.stage === stage).length;
                  return (
                    <span
                      key={stage}
                      className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink-muted"
                    >
                      {stage}
                      <span className="font-semibold text-ink">{n}</span>
                    </span>
                  );
                })}
              </div>

              {/* Candidates table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wider text-ink-faint">
                      <th className="px-5 py-3 font-medium">Candidate</th>
                      <th className="px-5 py-3 font-medium">Stage</th>
                      <th className="px-5 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedJob.candidates.map((c) => (
                      <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                        <td className="px-5 py-3">
                          <p className="font-medium text-ink">{c.name}</p>
                          {c.email && <p className="text-xs text-ink-muted">{c.email}</p>}
                          {c.notes && <p className="mt-0.5 text-xs text-ink-faint">{c.notes}</p>}
                        </td>
                        <td className="px-5 py-3">
                          <select
                            value={c.stage}
                            disabled={isPending}
                            onChange={(e) => handleStage(c.id, e.target.value)}
                            className="rounded-lg border border-border bg-bg px-2 py-1.5 text-xs text-ink outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/40"
                          >
                            {CANDIDATE_STAGES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end">
                            <button
                              onClick={() => handleDeleteCandidate(c.id, c.name)}
                              aria-label={`Remove ${c.name}`}
                              className="grid h-8 w-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface hover:text-critical"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {selectedJob.candidates.length === 0 && (
                  <div className="grid place-items-center py-12 text-center">
                    <p className="text-sm text-ink-muted">No candidates yet. Add the first applicant.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="grid h-full place-items-center p-12 text-center">
              <p className="text-sm text-ink-muted">Select or create a job to see its candidates.</p>
            </div>
          )}
        </div>
      </div>

      <JobFormModal
        open={jobModalOpen}
        editing={editingJob}
        departments={departments}
        onClose={() => setJobModalOpen(false)}
        onSave={handleSaveJob}
      />

      {selectedJob && (
        <CandidateFormModal
          open={candidateModalOpen}
          jobId={selectedJob.id}
          jobTitle={selectedJob.title}
          onClose={() => setCandidateModalOpen(false)}
          onSave={handleAddCandidate}
        />
      )}
    </div>
  );
}
