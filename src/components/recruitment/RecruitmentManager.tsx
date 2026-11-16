"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Download,
  ChevronLeft,
  ArrowRight,
  X,
  MapPin,
  UserPlus,
  Clock,
  Zap,
  TrendingUp,
  MessageSquareText,
  Star,
} from "lucide-react";
import { initialsOf } from "@/lib/sample-data";
import { deptTint, deptBadgeClass } from "@/lib/dept-tint";
import { type JobRow, type JobInput, type CandidateInput, type CandidateRow } from "@/lib/recruitment";
import { createJob, updateJob, deleteJob, createCandidate, setCandidateStage, deleteCandidate } from "@/lib/recruitment-actions";
import JobFormModal from "./JobFormModal";
import CandidateFormModal from "./CandidateFormModal";

type DeptOption = { id: string; name: string };
// A candidate together with the job they applied for.
type Card = CandidateRow & { job: JobRow };

// The forward path through the pipeline (Rejected sits outside it).
const FLOW = ["Applied", "Screening", "Interview", "Offer", "Hired"] as const;
const COLUMN_LIMIT = 5; // cards shown per column before "+N more"
const DAY = 86_400_000;

const SORTS = {
  activity: { label: "Last activity", fn: (a: Card, b: Card) => b.updatedAt.localeCompare(a.updatedAt) },
  newest: { label: "Newest applicants", fn: (a: Card, b: Card) => b.createdAt.localeCompare(a.createdAt) },
  name: { label: "Name (A → Z)", fn: (a: Card, b: Card) => a.name.localeCompare(b.name) },
} as const;
type SortKey = keyof typeof SORTS;

// Small coloured pill showing whether a job is still hiring.
function JobStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Open: "bg-good/10 text-good",
    "On hold": "bg-warning/10 text-warning",
    Closed: "bg-surface-2 text-ink-faint",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-label-sm ${styles[status] ?? styles.Closed}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "Open" ? "bg-good" : status === "On hold" ? "bg-warning" : "bg-ink-faint"}`} />
      {status === "Open" ? "Hiring" : status}
    </span>
  );
}

// Round avatar with initials, tinted by the job's department.
function Avatar({ name, department, size = "h-9 w-9" }: { name: string; department: string; size?: string }) {
  return (
    <span className={`grid ${size} shrink-0 place-items-center rounded-full text-label-sm font-semibold text-ink ${deptTint(department)}`}>
      {initialsOf(name)}
    </span>
  );
}

export default function RecruitmentManager({
  jobs,
  departments,
  now,
}: {
  jobs: JobRow[];
  departments: DeptOption[];
  now: string; // ISO time from the server
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"pipeline" | "jobs">("pipeline");
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<JobRow | null>(null);
  const [candidateModal, setCandidateModal] = useState<{ jobId: string | null; stage: string } | null>(null);
  const [query, setQuery] = useState("");
  const [jobFilter, setJobFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [sort, setSort] = useState<SortKey>("activity");
  const [showRejected, setShowRejected] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({}); // columns showing all cards
  const [isPending, startTransition] = useTransition();
  // Stable list for the candidate form (a new array every render would reset the form while typing).
  const jobOptions = useMemo(() => jobs.map((j) => ({ id: j.id, title: j.title })), [jobs]);

  // Turn an ISO date into "3h ago" / "4d ago", measured from the server's "now".
  const nowMs = new Date(now).getTime();
  const ago = (iso: string) => {
    const mins = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 60000));
    if (mins < 60) return `${mins || 1}m`;
    if (mins < 1440) return `${Math.round(mins / 60)}h`;
    const days = Math.round(mins / 1440);
    return days < 30 ? `${days}d` : `${Math.round(days / 30)}mo`;
  };

  // ── Flatten every candidate with their job ────────────────────────
  const all: Card[] = jobs.flatMap((job) => job.candidates.map((c) => ({ ...c, job })));
  const isActive = (c: CandidateRow) => c.stage !== "Hired" && c.stage !== "Rejected";
  const active = all.filter(isActive);
  const count = (stage: string) => all.filter((c) => c.stage === stage).length;

  // ── Headline numbers (all from real candidate/job rows) ───────────
  const openJobs = jobs.filter((j) => j.status === "Open");
  const newThisWeek = all.filter((c) => nowMs - new Date(c.createdAt).getTime() <= 7 * DAY).length;
  const reachedInterview = count("Interview") + count("Offer") + count("Hired");
  const reachedPct = all.length ? Math.round((reachedInterview / all.length) * 100) : 0;
  const hired = count("Hired");
  const offers = count("Offer");
  // Time to hire ≈ days from application to the last stage change of hired candidates.
  const hiredCards = all.filter((c) => c.stage === "Hired");
  const avgDaysToHire = hiredCards.length
    ? Math.round(
        hiredCards.reduce((sum, c) => sum + (new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime()), 0) /
          hiredCards.length /
          DAY,
      )
    : null;
  // Most recent stage changes, newest first (for the "Latest moves" panel).
  const latest = [...all].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);

  // ── Filtered board ────────────────────────────────────────────────
  const q = query.trim().toLowerCase();
  const filtered = all
    .filter((c) => jobFilter === "all" || c.jobId === jobFilter)
    .filter((c) => deptFilter === "all" || c.job.department === deptFilter)
    .filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.email ?? "").toLowerCase().includes(q) ||
        (c.notes ?? "").toLowerCase().includes(q) ||
        c.job.title.toLowerCase().includes(q),
    )
    .sort(SORTS[sort].fn);
  const columns: string[] = showRejected ? [...FLOW, "Rejected"] : [...FLOW];

  // ── Actions (every one re-checked on the server) ──────────────────
  function run(fn: () => Promise<void>, after?: () => void) {
    startTransition(async () => {
      try {
        await fn();
        after?.();
        router.refresh(); // fresh server data → counts and columns stay correct
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }
  const handleSaveJob = (data: JobInput, id?: string) =>
    run(() => (id ? updateJob(id, data) : createJob(data)), () => setJobModalOpen(false));
  function handleDeleteJob(job: JobRow) {
    const msg = job.candidates.length ? `Delete "${job.title}" and its ${job.candidates.length} candidate(s)?` : `Delete "${job.title}"?`;
    if (window.confirm(msg)) run(() => deleteJob(job.id));
  }
  const handleAddCandidate = (data: CandidateInput) => run(() => createCandidate(data), () => setCandidateModal(null));
  const move = (c: Card, stage: string) => run(() => setCandidateStage(c.id, stage));
  function remove(c: Card) {
    if (window.confirm(`Remove ${c.name} from the ${c.job.title} pipeline?`)) run(() => deleteCandidate(c.id));
  }
  function openAddCandidate(stage = "Applied") {
    // Default to the job being filtered on, else the first open job.
    setCandidateModal({ jobId: jobFilter !== "all" ? jobFilter : (openJobs[0]?.id ?? jobs[0]?.id ?? null), stage });
  }
  function openNewJob() {
    setEditingJob(null);
    setJobModalOpen(true);
  }
  // Clicking a role elsewhere on the page filters the board to it.
  function focusJob(id: string) {
    setJobFilter(id);
    setTab("pipeline");
  }

  function exportCsv() {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [
      ["Candidate", "Email", "Job", "Department", "Stage", "Notes", "Applied", "Last update"],
      ...all.map((c) => [c.name, c.email ?? "", c.job.title, c.job.department, c.stage, c.notes ?? "", c.createdAt.slice(0, 10), c.updatedAt.slice(0, 10)]),
    ];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `recruitment-pipeline-${now.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const control =
    "h-10 rounded-full border border-border bg-surface px-4 text-label-md text-ink outline-none transition-colors hover:bg-bg focus:border-ink focus:ring-1 focus:ring-ink";
  const outlineBtn =
    "inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-4 text-label-md text-ink transition-colors hover:bg-bg disabled:opacity-50";
  const deptNames = [...new Set(jobs.map((j) => j.department).filter((d) => d !== "—"))].sort();
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

  return (
    <div className="space-y-6">
      {/* ── Header: eyebrow, data-driven headline, actions ── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
          <div className="flex items-center gap-2">
            <span>Operations</span>
            <span>/</span>
            <span className="text-ink">Recruitment &amp; talent pipeline</span>
          </div>
          {isPending && <span className="normal-case tracking-normal text-body-sm font-normal text-ink-muted">Saving…</span>}
        </div>
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div className="max-w-2xl space-y-2">
            <h1 className="text-headline-lg text-ink md:text-headline-xl">
              {plural(openJobs.length, "role")}, {plural(active.length, "person", "people")} in the pipeline.
            </h1>
            <p className="text-body-lg text-ink-muted">Candidate stages, offers and hiring velocity across your open requisitions.</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <select aria-label="Department" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className={control}>
              <option value="all">All departments ({deptNames.length})</option>
              {deptNames.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <button onClick={exportCsv} disabled={all.length === 0} className={outlineBtn}>
              <Download className="h-4 w-4" />
              Export pipeline
            </button>
            <button onClick={() => openAddCandidate()} disabled={isPending || jobs.length === 0} className={outlineBtn}>
              <UserPlus className="h-4 w-4" />
              Add candidate
            </button>
            <button
              onClick={openNewJob}
              disabled={isPending}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-label-md text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Post a job
            </button>
          </div>
        </div>

        {/* Tabs: board vs. the full list of job postings */}
        <div className="flex gap-6 border-b border-border" role="tablist">
          {(
            [
              ["pipeline", "Pipeline", active.length],
              ["jobs", "Job postings", jobs.length],
            ] as const
          ).map(([key, label, n]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`-mb-px flex items-center gap-2 border-b-2 pb-3 text-label-md transition-colors ${
                tab === key ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {label}
              <span className={`tnum rounded-full px-2 py-0.5 text-[11px] font-bold ${tab === key ? "bg-navy text-on-navy" : "bg-surface-2 text-ink-muted"}`}>{n}</span>
            </button>
          ))}
        </div>
      </section>

      {tab === "pipeline" ? (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          {/* ── Left: toolbar + board + velocity strip ── */}
          <section className="min-w-0 space-y-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search candidates, emails, notes or roles…"
                  className="h-10 w-full rounded-full border border-border bg-surface pl-10 pr-4 text-body-sm text-ink outline-none placeholder:text-ink-faint focus:border-ink focus:ring-1 focus:ring-ink"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <select aria-label="Role" value={jobFilter} onChange={(e) => setJobFilter(e.target.value)} className={control}>
                  <option value="all">All roles</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </select>
                <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={control}>
                  {Object.entries(SORTS).map(([k, s]) => (
                    <option key={k} value={k}>
                      Sort: {s.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setShowRejected((v) => !v)}
                  aria-pressed={showRejected}
                  className={`${control} ${showRejected ? "border-critical/40 text-critical" : "text-ink-muted"}`}
                >
                  {showRejected ? "Hide" : "Show"} rejected ({count("Rejected")})
                </button>
              </div>
            </div>
            <p className="text-body-sm text-ink-muted">
              Showing {filtered.filter((c) => columns.includes(c.stage)).length} candidates · sorted by {SORTS[sort].label.toLowerCase()} · use the arrows on a card to move it between stages
            </p>

            {/* Board (scrolls sideways inside its own box on small screens) */}
            <div className="overflow-x-auto rounded-xl bg-surface-2 p-2.5">
              <div className="flex gap-2.5" style={{ minWidth: `${columns.length * 228}px` }}>
                {columns.map((stage) => {
                  const cards = filtered.filter((c) => c.stage === stage);
                  const open = expanded[stage];
                  const shown = open ? cards : cards.slice(0, COLUMN_LIMIT);
                  const idx = FLOW.indexOf(stage as (typeof FLOW)[number]);
                  const highlight = stage === "Offer"; // the stage that needs action
                  return (
                    <div key={stage} className={`flex w-56 shrink-0 flex-col gap-2.5 rounded-lg p-1 xl:flex-1 ${highlight ? "border-t-4 border-accent bg-accent-soft/40" : ""}`}>
                      <div className="flex items-center justify-between px-1.5 pt-1.5">
                        <div className="flex items-center gap-2">
                          <h3 className="font-display text-headline-sm text-ink">{stage}</h3>
                          <span
                            className={`tnum rounded-full px-2 py-0.5 text-[11px] font-bold ${highlight ? "bg-accent text-on-accent" : stage === "Rejected" ? "bg-critical/10 text-critical" : "bg-surface text-ink-muted"}`}
                          >
                            {cards.length}
                          </span>
                        </div>
                        {stage === "Offer" ? (
                          <Star className="h-4 w-4 text-accent-ink" />
                        ) : (
                          stage !== "Rejected" && (
                            <button
                              onClick={() => openAddCandidate(stage)}
                              disabled={jobs.length === 0}
                              aria-label={`Add candidate to ${stage}`}
                              className="grid h-6 w-6 place-items-center rounded-full text-ink-faint transition-colors hover:bg-surface hover:text-ink disabled:opacity-40"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          )
                        )}
                      </div>

                      {shown.map((c) => {
                        const next = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;
                        return (
                          <article key={c.id} className="group flex flex-col gap-2.5 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-border-strong">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <Avatar name={c.name} department={c.job.department} />
                              <div className="min-w-0">
                                <p className="truncate text-label-md text-ink">{c.name}</p>
                                <p className="truncate text-body-sm text-ink-muted">{c.job.title}</p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <span className={`${deptBadgeClass(c.job.department)} min-w-0 max-w-[55%]`}>
                                <span className="truncate">{c.job.department}</span>
                              </span>
                              <span className="tnum flex items-center gap-1 text-body-sm text-ink-faint" title={`Last update ${c.updatedAt.slice(0, 10)}`}>
                                <Clock className="h-3 w-3" />
                                {ago(c.updatedAt)} in stage
                              </span>
                            </div>

                            {c.notes && (
                              <div className="rounded-md bg-bg px-2.5 py-2">
                                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                                  <MessageSquareText className="h-3 w-3" />
                                  Notes
                                </p>
                                <p className="line-clamp-3 text-body-sm text-ink-muted">{c.notes}</p>
                              </div>
                            )}

                            {/* Move controls: back a stage, advance, reject/restore, remove */}
                            <div className="flex items-center justify-between gap-1">
                              <div className="flex items-center gap-0.5">
                                {idx > 0 && (
                                  <button disabled={isPending} onClick={() => move(c, FLOW[idx - 1])} title={`Back to ${FLOW[idx - 1]}`} aria-label={`Move ${c.name} back to ${FLOW[idx - 1]}`} className="grid h-7 w-7 place-items-center rounded-full text-ink-faint hover:bg-bg hover:text-ink disabled:opacity-40">
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                {stage === "Rejected" ? (
                                  <button disabled={isPending} onClick={() => move(c, "Applied")} title="Reconsider (back to Applied)" className="h-7 rounded-full px-2 text-label-sm text-ink-muted hover:bg-bg hover:text-ink disabled:opacity-40">
                                    Restore
                                  </button>
                                ) : (
                                  stage !== "Hired" && (
                                    <button disabled={isPending} onClick={() => move(c, "Rejected")} title="Reject" aria-label={`Reject ${c.name}`} className="grid h-7 w-7 place-items-center rounded-full text-ink-faint hover:bg-critical/10 hover:text-critical disabled:opacity-40">
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  )
                                )}
                                <button disabled={isPending} onClick={() => remove(c)} title="Remove from pipeline" aria-label={`Remove ${c.name}`} className="grid h-7 w-7 place-items-center rounded-full text-ink-faint hover:bg-critical/10 hover:text-critical disabled:opacity-40">
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                              {next && (
                                <button
                                  disabled={isPending}
                                  onClick={() => move(c, next)}
                                  aria-label={`Advance ${c.name} to ${next}`}
                                  className="inline-flex h-7 items-center gap-1 rounded-full bg-navy px-2.5 text-label-sm text-on-navy transition-opacity hover:opacity-90 disabled:opacity-40"
                                >
                                  {next}
                                  <ArrowRight className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </article>
                        );
                      })}

                      {cards.length === 0 && <p className="rounded-lg border border-dashed border-border-strong py-6 text-center text-body-sm text-ink-faint">No candidates</p>}

                      {cards.length > COLUMN_LIMIT && (
                        <button
                          onClick={() => setExpanded((e) => ({ ...e, [stage]: !open }))}
                          className="w-full rounded-full py-1.5 text-label-sm text-ink-muted transition-colors hover:bg-surface hover:text-ink"
                        >
                          {open ? "Show less" : `+ ${cards.length - COLUMN_LIMIT} more`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Velocity strip: new applicants this week + share that reached interview */}
            <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink">
                  <TrendingUp className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-label-md text-ink">Pipeline velocity: {plural(newThisWeek, "new applicant")} this week</p>
                  <p className="text-body-sm text-ink-muted">{plural(reachedInterview, "candidate")} of {all.length} have reached interview or beyond.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Reached interview</span>
                <div className="h-2 w-32 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-navy" style={{ width: `${reachedPct}%` }} />
                </div>
                <span className="tnum text-label-md text-ink">{reachedPct}%</span>
              </div>
            </div>
          </section>

          {/* ── Right rail ── */}
          <aside className="space-y-4">
            {/* Navy KPI card */}
            <div className="rounded-xl bg-navy p-5 text-on-navy">
              <div className="flex items-start justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-on-navy-muted">Average time to hire</p>
                <Zap className="h-4 w-4 text-[#f5c518]" />
              </div>
              <p className="mt-3 font-display text-metric-lg">
                {avgDaysToHire ?? "—"}
                {avgDaysToHire !== null && <span className="ml-1.5 text-headline-sm text-[#f5c518]">{avgDaysToHire === 1 ? "day" : "days"}</span>}
              </p>
              <p className="mt-2 text-body-sm text-on-navy-muted">
                {hiredCards.length ? `From application to hire, across ${plural(hiredCards.length, "hired candidate")}.` : "No hires yet — this fills in once someone is hired."}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-navy-line pt-4">
                {(
                  [
                    ["Hired", hired],
                    ["Offers out", offers],
                    ["In interview", count("Interview")],
                  ] as const
                ).map(([label, n]) => (
                  <div key={label}>
                    <p className="text-body-sm text-on-navy-muted">{label}</p>
                    <p className="tnum font-display text-headline-sm">{n}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Latest moves (real stage-change activity) */}
            <div className="rounded-xl border border-border bg-surface p-4">
              <h2 className="mb-3 font-display text-headline-sm text-ink">Latest moves</h2>
              {latest.length === 0 ? (
                <p className="text-body-sm text-ink-faint">No candidate activity yet.</p>
              ) : (
                <ul className="space-y-2">
                  {latest.map((c) => (
                    <li key={c.id} className="flex items-center gap-3 rounded-lg bg-bg p-2.5">
                      <Avatar name={c.name} department={c.job.department} size="h-8 w-8" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-label-md text-ink">{c.name}</p>
                        <p className="truncate text-body-sm text-ink-muted">{c.job.title}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-label-sm ${c.stage === "Rejected" ? "text-critical" : c.stage === "Hired" ? "text-good" : "text-ink"}`}>{c.stage}</p>
                        <p className="tnum text-body-sm text-ink-faint">{ago(c.updatedAt)} ago</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Active requisitions */}
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-display text-headline-sm text-ink">Active requisitions</h2>
                <button onClick={() => setTab("jobs")} className="text-label-md text-accent-ink hover:underline">
                  View all
                </button>
              </div>
              {openJobs.length === 0 ? (
                <p className="text-body-sm text-ink-faint">No open roles. Post a job to start hiring.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {openJobs.map((j) => (
                    <li key={j.id}>
                      <button onClick={() => focusJob(j.id)} title="Filter the board to this role" className="flex w-full items-center justify-between gap-3 py-3 text-left hover:opacity-80">
                        <div className="min-w-0">
                          <p className="truncate text-label-md text-ink">{j.title}</p>
                          <p className="truncate text-body-sm text-ink-muted">
                            {j.department} · {j.type}
                          </p>
                        </div>
                        <span className="tnum shrink-0 text-body-sm text-ink-muted">
                          <span className="font-semibold text-ink">{j.candidates.filter(isActive).length}</span> active
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {jobFilter !== "all" && (
                <button onClick={() => setJobFilter("all")} className="mt-2 w-full rounded-full bg-surface-2 py-2 text-label-md text-ink hover:bg-bg">
                  Show all roles on the board
                </button>
              )}
            </div>
          </aside>
        </div>
      ) : (
        /* ── Job postings table ── */
        <section className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
            <h2 className="font-display text-headline-md text-ink">Job postings</h2>
            <span className="rounded-full bg-good/10 px-2.5 py-0.5 text-label-sm text-good">{openJobs.length} hiring</span>
            <span className="text-body-sm text-ink-muted">Every role, its pipeline and how long it has been open.</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] leading-[18px]">
              <thead>
                <tr className="border-b border-border bg-bg text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  <th className="px-5 py-3">Role</th>
                  <th className="hidden px-4 py-3 md:table-cell">Department</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Location</th>
                  <th className="px-4 py-3 text-right">Applicants</th>
                  <th className="hidden px-4 py-3 sm:table-cell">In loop</th>
                  <th className="hidden px-4 py-3 md:table-cell">Open for</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const inLoop = j.candidates.filter((c) => c.stage === "Interview").length;
                  const jobOffers = j.candidates.filter((c) => c.stage === "Offer").length;
                  const daysOpen = Math.max(0, Math.round((nowMs - new Date(j.createdAt).getTime()) / DAY));
                  return (
                    <tr key={j.id} className="h-14 border-b border-border last:border-0 hover:bg-bg">
                      <td className="px-5 py-3">
                        <button onClick={() => focusJob(j.id)} className="text-left" title="Show this role's pipeline">
                          <p className="font-medium text-ink hover:underline">{j.title}</p>
                          <p className="text-body-sm text-ink-muted">{j.type}</p>
                        </button>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        {j.department !== "—" ? <span className={deptBadgeClass(j.department)}>{j.department}</span> : <span className="text-ink-faint">—</span>}
                      </td>
                      <td className="hidden px-4 py-3 text-ink-muted lg:table-cell">
                        {j.location ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-ink-faint" />
                            {j.location}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="tnum px-4 py-3 text-right text-ink">{j.candidates.length}</td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        {jobOffers > 0 ? (
                          <span className="tnum rounded-full bg-warning/10 px-2.5 py-0.5 text-label-sm text-warning">
                            {plural(jobOffers, "offer")} out
                          </span>
                        ) : inLoop > 0 ? (
                          <span className="tnum rounded-full bg-accent-soft px-2.5 py-0.5 text-label-sm text-accent-ink">{inLoop} interviewing</span>
                        ) : (
                          <span className="text-body-sm text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="tnum hidden px-4 py-3 text-ink-muted md:table-cell">{plural(daysOpen, "day")}</td>
                      <td className="px-4 py-3">
                        <JobStatusPill status={j.status} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => setCandidateModal({ jobId: j.id, stage: "Applied" })}
                            aria-label={`Add candidate to ${j.title}`}
                            title="Add candidate"
                            className="grid h-8 w-8 place-items-center rounded-full text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingJob(j);
                              setJobModalOpen(true);
                            }}
                            aria-label={`Edit ${j.title}`}
                            title="Edit role"
                            className="grid h-8 w-8 place-items-center rounded-full text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteJob(j)}
                            aria-label={`Delete ${j.title}`}
                            title="Delete role"
                            className="grid h-8 w-8 place-items-center rounded-full text-ink-faint transition-colors hover:bg-critical/10 hover:text-critical"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {jobs.length === 0 && (
              <div className="py-12 text-center">
                <p className="font-display text-headline-sm text-ink">No roles yet</p>
                <p className="mt-1 text-body-md text-ink-muted">Click “Post a job” to open your first position.</p>
              </div>
            )}
          </div>
        </section>
      )}

      <JobFormModal open={jobModalOpen} editing={editingJob} departments={departments} onClose={() => setJobModalOpen(false)} onSave={handleSaveJob} />
      <CandidateFormModal
        open={candidateModal !== null}
        jobs={jobOptions}
        defaultJobId={candidateModal?.jobId}
        defaultStage={candidateModal?.stage}
        onClose={() => setCandidateModal(null)}
        onSave={handleAddCandidate}
      />
    </div>
  );
}
