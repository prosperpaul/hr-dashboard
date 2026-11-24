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
import FilterBar from "@/components/ui/FilterBar";
import { ChipTabs, Segmented } from "@/components/ui/Chips";
import Fab from "@/components/ui/Fab";
import PageHeader from "@/components/ui/PageHeader";
import ResponsiveList from "@/components/ui/ResponsiveList";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form";
import ConfirmSheet, { type Confirmation } from "@/components/employees/ConfirmSheet";
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

// "2 offers out" / "3 interviewing" / "—" for a job's active loop.
function InLoop({ job }: { job: JobRow }) {
  const inLoop = job.candidates.filter((c) => c.stage === "Interview").length;
  const jobOffers = job.candidates.filter((c) => c.stage === "Offer").length;
  if (jobOffers > 0)
    return (
      <span className="tnum whitespace-nowrap rounded-full bg-warning/10 px-2.5 py-0.5 text-label-sm text-warning">
        {jobOffers} {jobOffers === 1 ? "offer" : "offers"} out
      </span>
    );
  if (inLoop > 0) return <span className="tnum whitespace-nowrap rounded-full bg-accent-soft px-2.5 py-0.5 text-label-sm text-accent-ink">{inLoop} interviewing</span>;
  return <span className="text-body-sm text-ink-faint">—</span>;
}

// Round avatar with initials, tinted by the job's department.
function Avatar({ name, department, size = "h-9 w-9" }: { name: string; department: string; size?: string }) {
  return (
    <span className={`grid ${size} shrink-0 place-items-center rounded-full text-label-sm font-semibold text-ink ${deptTint(department)}`}>
      {initialsOf(name)}
    </span>
  );
}

// A labelled filter dropdown. On phones (inside the Filters sheet) the label
// shows above a full-width field; on desktop it's a compact pill and the
// label is only read by screen readers.
function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-label-md text-ink md:sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} md:w-auto md:rounded-full md:px-4 md:text-label-md lg:min-h-10`}
      >
        {children}
      </select>
    </label>
  );
}

// One candidate card. Used by both the desktop kanban and the phone stage list.
// The move buttons are 48px on phones/tablets (easy thumb targets) and shrink
// back to the compact 28px desktop size from lg up.
function CandidateCard({
  c,
  stage,
  ago,
  disabled,
  onMove,
  onRemove,
}: {
  c: Card;
  stage: string;
  ago: (iso: string) => string;
  disabled: boolean;
  onMove: (c: Card, stage: string) => void;
  onRemove: (c: Card) => void;
}) {
  const idx = FLOW.indexOf(stage as (typeof FLOW)[number]);
  const next = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx + 1] : null;
  const iconBtn = "grid size-tap shrink-0 place-items-center rounded-full text-ink-faint disabled:opacity-40 lg:size-7";
  return (
    <article className="group flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong lg:gap-2.5 lg:rounded-lg lg:p-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar name={c.name} department={c.job.department} size="h-12 w-12 lg:h-9 lg:w-9" />
        <div className="min-w-0">
          <p className="truncate font-display text-headline-sm text-ink lg:font-sans lg:text-label-md">{c.name}</p>
          <p className="truncate text-body-sm text-ink-muted">{c.job.title}</p>
        </div>
      </div>

      {/* Wraps onto two lines on narrow columns instead of cutting
          the department name off or splitting "2d in stage". */}
      {/* Below lg these read as a row of small chips (mobile mockup); lg+ keeps the
          compact desktop look with the time pushed to the right. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 lg:justify-between">
        <span className={`${deptBadgeClass(c.job.department)} min-w-0 max-w-full`}>
          <span className="truncate">{c.job.department}</span>
        </span>
        <span
          className="tnum flex h-6 items-center gap-1 whitespace-nowrap rounded-full bg-sunken px-2.5 text-body-sm text-ink-muted lg:h-auto lg:bg-transparent lg:px-0 lg:text-ink-faint"
          title={`Last update ${c.updatedAt.slice(0, 10)}`}
        >
          <Clock className="h-3 w-3" aria-hidden />
          {ago(c.updatedAt)} in stage
        </span>
        {c.job.location && (
          <span className="flex h-6 min-w-0 max-w-full items-center gap-1 rounded-full bg-sunken px-2.5 text-body-sm text-ink-muted lg:hidden">
            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{c.job.location}</span>
          </span>
        )}
      </div>

      {c.notes && (
        <div className="rounded-lg bg-sunken p-3 lg:rounded-md lg:bg-bg lg:px-2.5 lg:py-2">
          <p className="mb-1 flex items-center gap-1.5 text-eyebrow uppercase text-ink-muted">
            <MessageSquareText className="h-3 w-3" aria-hidden />
            Notes
          </p>
          <p className="line-clamp-3 text-body-sm text-ink-muted [overflow-wrap:anywhere]">{c.notes}</p>
        </div>
      )}

      {/* Move controls: back a stage, advance, reject/restore, remove */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-0.5">
          {idx > 0 && (
            <button disabled={disabled} onClick={() => onMove(c, FLOW[idx - 1])} title={`Back to ${FLOW[idx - 1]}`} aria-label={`Move ${c.name} back to ${FLOW[idx - 1]}`} className={`${iconBtn} hover:bg-bg hover:text-ink`}>
              <ChevronLeft className="h-4 w-4 lg:h-3.5 lg:w-3.5" aria-hidden />
            </button>
          )}
          {stage === "Rejected" ? (
            <button disabled={disabled} onClick={() => onMove(c, "Applied")} title="Reconsider (back to Applied)" className="min-h-tap rounded-full px-3 text-label-sm text-ink-muted hover:bg-bg hover:text-ink disabled:opacity-40 lg:h-7 lg:min-h-0 lg:px-2">
              Restore
            </button>
          ) : (
            stage !== "Hired" && (
              <button disabled={disabled} onClick={() => onMove(c, "Rejected")} title="Reject" aria-label={`Reject ${c.name}`} className={`${iconBtn} hover:bg-critical/10 hover:text-critical`}>
                <X className="h-4 w-4 lg:h-3.5 lg:w-3.5" aria-hidden />
              </button>
            )
          )}
          <button disabled={disabled} onClick={() => onRemove(c)} title="Remove from pipeline" aria-label={`Remove ${c.name}`} className={`${iconBtn} hover:bg-critical/10 hover:text-critical`}>
            <Trash2 className="h-4 w-4 lg:h-3 lg:w-3" aria-hidden />
          </button>
        </div>
        {next && (
          <button
            disabled={disabled}
            onClick={() => onMove(c, next)}
            aria-label={`Advance ${c.name} to ${next}`}
            className="inline-flex min-h-tap shrink-0 items-center gap-1 rounded-full bg-navy px-4 text-label-sm text-on-navy transition-opacity hover:opacity-90 disabled:opacity-40 lg:h-7 lg:min-h-0 lg:px-2.5"
          >
            {next}
            <ArrowRight className="h-3 w-3" aria-hidden />
          </button>
        )}
      </div>
    </article>
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
  const [phoneStage, setPhoneStage] = useState<string>("Applied"); // stage tab picked on phones/tablets
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null); // "are you sure?" sheet
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
  // If "Rejected" was picked on phones and then hidden, fall back to the first stage.
  const activeStage = columns.includes(phoneStage) ? phoneStage : FLOW[0];
  // How many filters are hidden inside the phone "Filters" sheet.
  const filterCount =
    (jobFilter !== "all" ? 1 : 0) + (deptFilter !== "all" ? 1 : 0) + (sort !== "activity" ? 1 : 0) + (showRejected ? 1 : 0);
  function resetFilters() {
    setJobFilter("all");
    setDeptFilter("all");
    setSort("activity");
    setShowRejected(false);
  }

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
    setConfirmation({ title: "Delete job?", message: msg, confirmLabel: "Delete job", danger: true, onConfirm: () => run(() => deleteJob(job.id)) });
  }
  const handleAddCandidate = (data: CandidateInput) => run(() => createCandidate(data), () => setCandidateModal(null));
  const move = (c: Card, stage: string) => run(() => setCandidateStage(c.id, stage));
  function remove(c: Card) {
    setConfirmation({
      title: "Remove candidate?",
      message: `Remove ${c.name} from the ${c.job.title} pipeline?`,
      confirmLabel: "Remove",
      danger: true,
      onConfirm: () => run(() => deleteCandidate(c.id)),
    });
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

  const deptNames = [...new Set(jobs.map((j) => j.department).filter((d) => d !== "—"))].sort();
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

  // Add candidate / Edit / Delete for one job. Phones get full 48px buttons;
  // in the md+ table they stay 32px but carry an invisible 48px hit area
  // (the ::before box) until lg, so the row doesn't get taller.
  function jobActions(j: JobRow, phone: boolean) {
    const base = phone
      ? "grid size-tap place-items-center rounded-full text-ink-faint transition-colors"
      : "relative grid h-8 w-8 place-items-center rounded-full text-ink-faint transition-colors before:absolute before:-inset-2 before:content-[''] lg:before:hidden";
    return (
      <>
        <button
          onClick={() => setCandidateModal({ jobId: j.id, stage: "Applied" })}
          aria-label={`Add candidate to ${j.title}`}
          title="Add candidate"
          className={`${base} hover:bg-surface-2 hover:text-ink`}
        >
          <UserPlus className={phone ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden />
        </button>
        <button
          onClick={() => {
            setEditingJob(j);
            setJobModalOpen(true);
          }}
          aria-label={`Edit ${j.title}`}
          title="Edit role"
          className={`${base} hover:bg-surface-2 hover:text-ink`}
        >
          <Pencil className={phone ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden />
        </button>
        <button onClick={() => handleDeleteJob(j)} aria-label={`Delete ${j.title}`} title="Delete role" className={`${base} hover:bg-critical/10 hover:text-critical`}>
          <Trash2 className={phone ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden />
        </button>
      </>
    );
  }

  return (
    // Extra bottom padding below lg so the floating "Post a job" button never covers the last card.
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* ── Header: eyebrow, data-driven headline, actions ── */}
      <section>
        <PageHeader
          eyebrow={
            <>
              Recruitment &amp; talent pipeline
              {isPending && <span className="ml-2 normal-case tracking-normal text-ink-muted" aria-live="polite">Saving…</span>}
            </>
          }
          title={
            <>
              {plural(openJobs.length, "role")}, {plural(active.length, "person", "people")} in the pipeline.
            </>
          }
          description="Candidate stages, offers and hiring velocity across your open requisitions."
          actions={
            <>
              {/* Department filter lives here on md+; on phones it moves into the Filters sheet. */}
              <select
                aria-label="Department"
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className={`${inputClass} hidden w-auto rounded-full px-4 text-label-md md:order-first md:block lg:min-h-10`}
              >
                <option value="all">All departments ({deptNames.length})</option>
                {deptNames.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              {/* Below lg, "Post a job" is the floating yellow button (Fab) instead. */}
              <button onClick={openNewJob} disabled={isPending} className={`${buttonClass("primary")} order-last max-lg:hidden`}>
                <Plus className="h-4 w-4" aria-hidden />
                Post a job
              </button>
              <button onClick={() => openAddCandidate()} disabled={isPending || jobs.length === 0} className={`${buttonClass("secondary")} flex-1 md:flex-none`}>
                <UserPlus className="h-4 w-4" aria-hidden />
                Add candidate
              </button>
              <button onClick={exportCsv} disabled={all.length === 0} className={`${buttonClass("secondary")} flex-1 md:order-first md:flex-none`}>
                <Download className="h-4 w-4" aria-hidden />
                <span className="sm:hidden">Export</span>
                <span className="hidden sm:inline">Export pipeline</span>
              </button>
            </>
          }
        />

        {/* Tabs: board vs. the full list of job postings.
            Below lg: a full-width segmented control (Pipeline | Roles). lg+: underline tabs. */}
        <Segmented
          className="lg:hidden"
          label="Recruitment views"
          value={tab}
          onChange={(k) => setTab(k as "pipeline" | "jobs")}
          options={[
            { key: "pipeline", label: "Pipeline", count: active.length },
            { key: "jobs", label: "Roles", count: jobs.length },
          ]}
        />
        <div className="hidden gap-6 border-b border-border lg:flex" role="tablist" aria-label="Recruitment views">
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
              <span className={`tnum rounded-full px-2 py-0.5 text-label-sm font-bold ${tab === key ? "bg-navy text-on-navy" : "bg-surface-2 text-ink-muted"}`}>{n}</span>
            </button>
          ))}
        </div>
      </section>

      {tab === "pipeline" ? (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          {/* ── Left: toolbar + board + velocity strip ── */}
          <section className="min-w-0 space-y-4">
            {/* Search always visible; the other filters sit inline on md+ and in a
                "Filters" bottom sheet on phones. */}
            <FilterBar
              activeCount={filterCount}
              onReset={resetFilters}
              search={
                <div className="relative w-full">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
                  <input
                    type="search"
                    autoComplete="off"
                    enterKeyHint="search"
                    aria-label="Search candidates"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search candidates, emails, notes or roles…"
                    className={`${inputClass} rounded-full pl-10 pr-4 lg:min-h-10`}
                  />
                </div>
              }
            >
              {/* Phones only (md+ has this select in the page header). */}
              <div className="md:hidden">
                <FilterSelect label="Department" value={deptFilter} onChange={setDeptFilter}>
                  <option value="all">All departments ({deptNames.length})</option>
                  {deptNames.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </FilterSelect>
              </div>
              <FilterSelect label="Role" value={jobFilter} onChange={setJobFilter}>
                <option value="all">All roles</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.title}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect label="Sort" value={sort} onChange={(v) => setSort(v as SortKey)}>
                {Object.entries(SORTS).map(([k, s]) => (
                  <option key={k} value={k}>
                    Sort: {s.label}
                  </option>
                ))}
              </FilterSelect>
              <button
                type="button"
                onClick={() => setShowRejected((v) => !v)}
                aria-pressed={showRejected}
                className={`min-h-tap rounded-full border bg-surface px-4 text-label-md transition-colors hover:bg-bg lg:min-h-10 ${
                  showRejected ? "border-critical/40 text-critical" : "border-border text-ink-muted"
                }`}
              >
                {showRejected ? "Hide" : "Show"} rejected ({count("Rejected")})
              </button>
            </FilterBar>
            <p className="hidden text-body-sm text-ink-muted lg:block">
              Showing {filtered.filter((c) => columns.includes(c.stage)).length} candidates · sorted by {SORTS[sort].label.toLowerCase()} · use the buttons on a card to move it between stages
            </p>

            {/* Phones & tablets (below lg): a five-column board can't fit, so we show
                one stage at a time. Swipe the stage chips, then scroll the list. */}
            <div className="space-y-4 lg:hidden">
              <ChipTabs
                label="Pipeline stage"
                value={activeStage}
                onChange={setPhoneStage}
                options={columns.map((stage) => ({ key: stage, label: stage, count: filtered.filter((c) => c.stage === stage).length }))}
              />

              {(() => {
                const cards = filtered.filter((c) => c.stage === activeStage);
                const open = expanded[activeStage];
                const shown = open ? cards : cards.slice(0, COLUMN_LIMIT);
                return (
                  <section aria-label={`${activeStage} candidates`} className="space-y-3">
                    {/* Section title: stage name, a yellow dot and the count, plus a quick "add" */}
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="flex min-w-0 flex-wrap items-center gap-x-2 font-display text-headline-sm text-ink">
                        {activeStage}
                        <span className="flex items-center gap-1.5 font-sans text-body-sm text-ink-muted">
                          <span className="size-1.5 rounded-full bg-accent" aria-hidden />
                          <span className="tnum">{plural(cards.length, "candidate")}</span>
                        </span>
                      </h3>
                      {activeStage !== "Rejected" && (
                        <button
                          type="button"
                          onClick={() => openAddCandidate(activeStage)}
                          disabled={isPending || jobs.length === 0}
                          className={buttonClass("secondary")}
                        >
                          <UserPlus className="h-4 w-4" aria-hidden />
                          Add<span className="sr-only"> candidate to {activeStage}</span>
                        </button>
                      )}
                    </div>

                    {cards.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border-strong py-8 text-center text-body-sm text-ink-faint">No candidates in {activeStage}</p>
                    ) : (
                      <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {shown.map((c) => (
                          <li key={c.id} className="min-w-0">
                            <CandidateCard c={c} stage={activeStage} ago={ago} disabled={isPending} onMove={move} onRemove={remove} />
                          </li>
                        ))}
                      </ul>
                    )}
                    {cards.length > COLUMN_LIMIT && (
                      <button
                        type="button"
                        onClick={() => setExpanded((e) => ({ ...e, [activeStage]: !open }))}
                        className={buttonClass("ghost", { block: true })}
                      >
                        {open ? "Show less" : `+ ${cards.length - COLUMN_LIMIT} more`}
                      </button>
                    )}
                  </section>
                );
              })()}
            </div>

            {/* Desktop (lg+): the kanban board (scrolls sideways inside its own box if narrow) */}
            <div className="hidden overflow-x-auto rounded-xl bg-surface-2 p-2.5 lg:block">
              <div className="flex gap-2.5" style={{ minWidth: `${columns.length * 228}px` }}>
                {columns.map((stage) => {
                  const cards = filtered.filter((c) => c.stage === stage);
                  const open = expanded[stage];
                  const shown = open ? cards : cards.slice(0, COLUMN_LIMIT);
                  const highlight = stage === "Offer"; // the stage that needs action
                  return (
                    <div key={stage} className={`flex w-56 shrink-0 flex-col gap-2.5 rounded-lg p-1 xl:flex-1 ${highlight ? "border-t-4 border-accent bg-accent-soft/40" : ""}`}>
                      <div className="flex items-center justify-between px-1.5 pt-1.5">
                        <div className="flex items-center gap-2">
                          <h3 className="font-display text-headline-sm text-ink">{stage}</h3>
                          <span
                            className={`tnum rounded-full px-2 py-0.5 text-label-sm font-bold ${highlight ? "bg-accent text-on-accent" : stage === "Rejected" ? "bg-critical/10 text-critical" : "bg-surface text-ink-muted"}`}
                          >
                            {cards.length}
                          </span>
                        </div>
                        {stage === "Offer" ? (
                          <Star className="h-4 w-4 text-accent-ink" aria-hidden />
                        ) : (
                          stage !== "Rejected" && (
                            <button
                              onClick={() => openAddCandidate(stage)}
                              disabled={jobs.length === 0}
                              aria-label={`Add candidate to ${stage}`}
                              className="grid h-6 w-6 place-items-center rounded-full text-ink-faint transition-colors hover:bg-surface hover:text-ink disabled:opacity-40"
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden />
                            </button>
                          )
                        )}
                      </div>

                      {shown.map((c) => (
                        <CandidateCard key={c.id} c={c} stage={stage} ago={ago} disabled={isPending} onMove={move} onRemove={remove} />
                      ))}

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
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-ink">
                  <TrendingUp className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-label-md text-ink">Pipeline velocity: {plural(newThisWeek, "new applicant")} this week</p>
                  <p className="text-body-sm text-ink-muted">{plural(reachedInterview, "candidate")} of {all.length} have reached interview or beyond.</p>
                </div>
              </div>
              {/* On phones the bar stretches to fill the row; from sm up it's a fixed 128px. */}
              <div className="flex min-w-0 items-center gap-3">
                <span className="shrink-0 text-eyebrow uppercase text-ink-muted">Reached interview</span>
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2 sm:w-32 sm:flex-none">
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
                <p className="text-eyebrow uppercase text-on-navy-muted">Average time to hire</p>
                <Zap className="h-4 w-4 text-accent" aria-hidden />
              </div>
              <p className="mt-3 font-display text-metric-lg">
                {avgDaysToHire ?? "—"}
                {avgDaysToHire !== null && <span className="ml-1.5 text-headline-sm text-accent">{avgDaysToHire === 1 ? "day" : "days"}</span>}
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
                  // min-w-0 + wrapping labels keep three columns inside a 360px screen.
                  <div key={label} className="min-w-0">
                    <p className="text-body-sm leading-tight text-on-navy-muted [overflow-wrap:anywhere]">{label}</p>
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
                <button onClick={() => setTab("jobs")} className="-mr-2 min-h-tap rounded-full px-2 text-label-md text-accent-ink hover:underline lg:mr-0 lg:min-h-0 lg:px-0">
                  View all
                </button>
              </div>
              {openJobs.length === 0 ? (
                <p className="text-body-sm text-ink-faint">No open roles. Post a job to start hiring.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {openJobs.map((j) => (
                    <li key={j.id}>
                      <button onClick={() => focusJob(j.id)} title="Filter the board to this role" className="flex min-h-tap w-full items-center justify-between gap-3 py-3 text-left hover:opacity-80">
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
                <button onClick={() => setJobFilter("all")} className="mt-2 min-h-tap w-full rounded-full bg-surface-2 py-2 text-label-md text-ink hover:bg-bg lg:min-h-0">
                  Show all roles on the board
                </button>
              )}
            </div>
          </aside>
        </div>
      ) : (
        /* ── Job postings: a table on md+, stacked rows on phones (ResponsiveList) ── */
        <section className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-4 md:px-5">
            <h2 className="font-display text-headline-md text-ink">Job postings</h2>
            <span className="rounded-full bg-good/10 px-2.5 py-0.5 text-label-sm text-good">{openJobs.length} hiring</span>
            <span className="w-full text-body-sm text-ink-muted md:w-auto">Every role, its pipeline and how long it has been open.</span>
          </div>
          <ResponsiveList
            inset
            caption="Job postings"
            rows={jobs}
            getKey={(j) => j.id}
            empty={
              <div className="px-4 py-12 text-center">
                <p className="font-display text-headline-sm text-ink">No roles yet</p>
                <p className="mt-1 text-body-md text-ink-muted">Tap “Post a job” to open your first position.</p>
              </div>
            }
            columns={[
              {
                key: "role",
                header: "Role",
                headerClassName: "pl-5",
                className: "pl-5",
                cell: (j) => (
                  <button onClick={() => focusJob(j.id)} className="text-left" title="Show this role's pipeline">
                    <p className="font-medium text-ink hover:underline">{j.title}</p>
                    <p className="text-body-sm text-ink-muted">{j.type}</p>
                  </button>
                ),
              },
              {
                key: "dept",
                header: "Department",
                cell: (j) => (j.department !== "—" ? <span className={deptBadgeClass(j.department)}>{j.department}</span> : <span className="text-ink-faint">—</span>),
              },
              {
                key: "location",
                header: "Location",
                headerClassName: "hidden lg:table-cell",
                className: "hidden text-ink-muted lg:table-cell",
                cell: (j) =>
                  j.location ? (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-ink-faint" aria-hidden />
                      {j.location}
                    </span>
                  ) : (
                    "—"
                  ),
              },
              { key: "applicants", header: "Applicants", align: "right", className: "tnum text-ink", cell: (j) => j.candidates.length },
              { key: "loop", header: "In loop", cell: (j) => <InLoop job={j} /> },
              {
                key: "open",
                header: "Open for",
                className: "tnum whitespace-nowrap text-ink-muted",
                cell: (j) => plural(Math.max(0, Math.round((nowMs - new Date(j.createdAt).getTime()) / DAY)), "day"),
              },
              { key: "status", header: "Status", cell: (j) => <JobStatusPill status={j.status} /> },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                headerClassName: "pr-5",
                className: "pr-5",
                cell: (j) => <div className="flex justify-end gap-1">{jobActions(j, false)}</div>,
              },
            ]}
            renderRow={(j) => (
              // Phone row: role + facts on the left, status on the right, then
              // three 48px action buttons underneath.
              <div className="space-y-2 px-4 py-3">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <button onClick={() => focusJob(j.id)} className="min-h-tap min-w-0 text-left" title="Show this role's pipeline">
                    <p className="truncate text-label-md text-ink">{j.title}</p>
                    <p className="truncate text-body-sm text-ink-muted">
                      {[j.department !== "—" ? j.department : null, j.type, j.location].filter(Boolean).join(" · ")}
                    </p>
                  </button>
                  <JobStatusPill status={j.status} />
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-ink-muted">
                  <span className="tnum">
                    <span className="font-semibold text-ink">{j.candidates.length}</span> {j.candidates.length === 1 ? "applicant" : "applicants"}
                  </span>
                  <InLoop job={j} />
                </div>
                <div className="-mx-2 flex items-center gap-1">{jobActions(j, true)}</div>
              </div>
            )}
          />
        </section>
      )}

      <ConfirmSheet confirmation={confirmation} onClose={() => setConfirmation(null)} />
      {/* Phones & tablets: the page's main action floats above the tab bar. */}
      <Fab label="Post a job" icon={<Plus className="h-5 w-5" />} onClick={openNewJob} />

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
