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
  ChevronRight,
  X,
  MapPin,
  UserPlus,
  Clock,
} from "lucide-react";
import { initialsOf } from "@/lib/sample-data";
import { type JobRow, type JobInput, type CandidateInput, type CandidateRow } from "@/lib/recruitment";
import { createJob, updateJob, deleteJob, createCandidate, setCandidateStage, deleteCandidate } from "@/lib/recruitment-actions";
import StatCard, { type DashStat } from "@/components/dashboard/StatCard";
import { Pill } from "@/components/dashboard/Panel";
import JobFormModal from "./JobFormModal";
import CandidateFormModal from "./CandidateFormModal";

type DeptOption = { id: string; name: string };
// A candidate together with the job they applied for.
type Card = CandidateRow & { job: JobRow };

// The forward path through the pipeline (Rejected sits outside it).
const FLOW = ["Applied", "Screening", "Interview", "Offer", "Hired"] as const;
const COLUMN_LIMIT = 5; // cards shown per column before "+N more"
const DAY = 86_400_000;

const STAGE_DOT: Record<string, string> = {
  Applied: "bg-ink-faint",
  Screening: "bg-sky-400",
  Interview: "bg-accent",
  Offer: "bg-warning",
  Hired: "bg-accent-hover",
  Rejected: "bg-critical",
};

const SORTS = {
  activity: { label: "Last activity", fn: (a: Card, b: Card) => b.updatedAt.localeCompare(a.updatedAt) },
  newest: { label: "Newest applicants", fn: (a: Card, b: Card) => b.createdAt.localeCompare(a.createdAt) },
  name: { label: "Name (A → Z)", fn: (a: Card, b: Card) => a.name.localeCompare(b.name) },
} as const;
type SortKey = keyof typeof SORTS;

function JobStatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Open: "border-accent/25 bg-accent-soft text-accent-hover",
    "On hold": "border-warning/30 bg-warning/10 text-warning",
    Closed: "border-border bg-white/[0.04] text-ink-faint",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-label-sm ${styles[status] ?? styles.Closed}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "Open" ? "bg-accent" : status === "On hold" ? "bg-warning" : "bg-ink-faint"}`} />
      {status === "Open" ? "Active sourcing" : status}
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

  const nowMs = new Date(now).getTime();
  const ago = (iso: string) => {
    const mins = Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 60000));
    if (mins < 60) return `${mins || 1}m ago`;
    if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
    const days = Math.round(mins / 1440);
    return days < 30 ? `${days}d ago` : `${Math.round(days / 30)}mo ago`;
  };

  // ── Flatten every candidate with their job ────────────────────────
  const all: Card[] = jobs.flatMap((job) => job.candidates.map((c) => ({ ...c, job })));
  const active = all.filter((c) => c.stage !== "Hired" && c.stage !== "Rejected");
  const count = (stage: string) => all.filter((c) => c.stage === stage).length;

  // ── Headline numbers ──────────────────────────────────────────────
  const openJobs = jobs.filter((j) => j.status === "Open");
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
  const postedThisMonth = jobs.filter((j) => new Date(j.createdAt).getTime() >= monthStart).length;
  const newThisWeek = all.filter((c) => nowMs - new Date(c.createdAt).getTime() <= 7 * DAY).length;
  // New applicants per week for the last 8 weeks (oldest first) → sparkline.
  const weekly = Array.from({ length: 8 }, (_, i) => {
    const end = nowMs - (7 - i) * 7 * DAY;
    return all.filter((c) => {
      const t = new Date(c.createdAt).getTime();
      return t > end - 7 * DAY && t <= end;
    }).length;
  });
  const busiest = [...jobs].sort(
    (a, b) => b.candidates.filter((c) => c.stage !== "Hired" && c.stage !== "Rejected").length - a.candidates.filter((c) => c.stage !== "Hired" && c.stage !== "Rejected").length,
  )[0];
  const reachedInterview = count("Interview") + count("Offer") + count("Hired");
  const hired = count("Hired");
  const offers = count("Offer");

  const stats: DashStat[] = [
    {
      key: "open",
      label: "Open positions",
      value: String(openJobs.length),
      badge: postedThisMonth > 0 ? { text: `+${postedThisMonth} this month`, trend: "up" } : undefined,
      side: (
        <span className="mb-1 mr-auto ml-2 text-body-sm text-ink-faint">
          across {new Set(openJobs.map((j) => j.department)).size} depts
        </span>
      ),
      bar: [
        { value: openJobs.length, className: "bg-accent" },
        { value: jobs.length - openJobs.length, className: "bg-transparent" },
      ],
      footer: { label: "On hold · Closed", value: `${jobs.filter((j) => j.status === "On hold").length} · ${jobs.filter((j) => j.status === "Closed").length}` },
    },
    {
      key: "applicants",
      label: "Active applicants",
      value: String(active.length),
      badge: newThisWeek > 0 ? { text: `+${newThisWeek} this week`, trend: "up" } : undefined,
      spark: weekly.some((n) => n > 0) ? weekly : undefined,
      footer: busiest
        ? { label: "Busiest role", value: busiest.title, accent: true }
        : { label: "Busiest role", value: "—" },
    },
    {
      key: "interview",
      label: "In interviews",
      value: String(count("Interview")),
      side: <span className="mb-1 mr-auto ml-2 text-body-sm text-ink-faint">{count("Screening")} in screening</span>,
      bar: [
        { value: count("Interview"), className: "bg-accent" },
        { value: count("Screening"), className: "bg-sky-400/60" },
        { value: count("Applied"), className: "bg-transparent" },
      ],
      footer: { label: "Reached interview", value: all.length ? `${Math.round((reachedInterview / all.length) * 100)}% of all` : "—" },
    },
    {
      key: "offers",
      label: "Offers in pipeline",
      value: String(offers),
      badge: offers > 0 ? { text: "Action needed", dot: true } : undefined,
      side: <span className="mb-1 mr-auto ml-2 text-body-sm text-ink-faint">{hired} hired</span>,
      bar: [
        { value: hired, className: "bg-accent" },
        { value: offers, className: "bg-warning/70" },
      ],
      footer: { label: "Offer → hire", value: hired + offers ? `${Math.round((hired / (hired + offers)) * 100)}% closed` : "—" },
    },
  ];

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
    "h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-label-md text-ink outline-none transition-colors hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent";
  const deptNames = [...new Set(jobs.map((j) => j.department).filter((d) => d !== "—"))].sort();

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-label-sm uppercase tracking-wider text-ink-faint">
            <span>Operations</span>
            <span>/</span>
            <span className="normal-case tracking-normal text-ink-muted">Recruitment</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-headline-lg text-ink md:text-headline-xl">Recruitment &amp; Talent Pipeline</h1>
            <Pill tone="accent" dot>
              {active.length} in pipeline
            </Pill>
          </div>
          <p className="max-w-2xl text-body-md text-ink-muted">
            {isPending ? "Working…" : "Track candidates from application to offer, and manage your open roles."}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={all.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 text-label-md text-ink transition-colors hover:border-border-strong hover:bg-white/[0.03] disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export pipeline
          </button>
          <button
            onClick={() => openAddCandidate()}
            disabled={isPending || jobs.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 text-label-md text-ink transition-colors hover:border-border-strong hover:bg-white/[0.03] disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            Add candidate
          </button>
          <button
            onClick={() => {
              setEditingJob(null);
              setJobModalOpen(true);
            }}
            disabled={isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-label-md font-semibold text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] transition-colors hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Post job
          </button>
        </div>
      </section>

      {/* ── KPI cards ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.key} stat={s} />
        ))}
      </section>

      {/* ── Toolbar ── */}
      <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-2 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter candidates by name, email, notes or role…"
            className="h-9 w-full rounded-lg border border-border bg-surface-2 pl-8 pr-3 text-body-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
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
          <select aria-label="Department" value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className={control}>
            <option value="all">All departments</option>
            {deptNames.map((d) => (
              <option key={d} value={d}>
                {d}
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
      </section>

      {/* ── Pipeline board (scrolls sideways on small screens) ── */}
      <section className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        <div className="flex gap-4" style={{ minWidth: `${columns.length * 272}px` }}>
          {columns.map((stage) => {
            const cards = filtered.filter((c) => c.stage === stage);
            const open = expanded[stage];
            const shown = open ? cards : cards.slice(0, COLUMN_LIMIT);
            const idx = FLOW.indexOf(stage as (typeof FLOW)[number]);
            const highlight = stage === "Interview";
            return (
              <div
                key={stage}
                className={`flex w-64 shrink-0 flex-col rounded-xl border bg-surface p-3 xl:flex-1 ${highlight ? "border-accent/40" : "border-border"}`}
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${STAGE_DOT[stage]}`} />
                    <h3 className="text-label-md text-ink">{stage === "Interview" ? "Interview loops" : stage}</h3>
                    <span className="tnum rounded-full bg-surface-2 px-1.5 text-label-sm text-ink-muted">{cards.length}</span>
                  </div>
                  {stage !== "Rejected" && (
                    <button
                      onClick={() => openAddCandidate(stage)}
                      disabled={jobs.length === 0}
                      aria-label={`Add candidate to ${stage}`}
                      className="grid h-6 w-6 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-40"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {shown.map((c) => (
                    <article
                      key={c.id}
                      className={`group rounded-lg border bg-surface-2 p-3 transition-colors hover:border-border-strong ${
                        highlight ? "border-l-2 border-border border-l-accent" : "border-border"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-label-sm font-semibold text-accent-hover">
                            {initialsOf(c.name)}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-label-md text-ink">{c.name}</p>
                            <p className="truncate text-body-sm text-ink-faint">{c.job.title}</p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-md border border-border bg-bg px-1.5 py-0.5 text-[10px] text-ink-faint">{c.job.department}</span>
                      </div>

                      {c.notes && <p className="mt-2.5 line-clamp-2 rounded-md bg-bg/60 px-2 py-1.5 text-body-sm text-ink-muted">{c.notes}</p>}

                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1 text-body-sm text-ink-faint" title={`Last update ${c.updatedAt.slice(0, 10)}`}>
                          <Clock className="h-3 w-3" />
                          {ago(c.updatedAt)}
                        </span>
                        {/* Move controls: back / forward a stage, reject, remove */}
                        <div className="flex items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                          {idx > 0 && (
                            <button disabled={isPending} onClick={() => move(c, FLOW[idx - 1])} title={`Back to ${FLOW[idx - 1]}`} aria-label={`Move ${c.name} back to ${FLOW[idx - 1]}`} className="grid h-6 w-6 place-items-center rounded text-ink-faint hover:bg-bg hover:text-ink disabled:opacity-40">
                              <ChevronLeft className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {idx >= 0 && idx < FLOW.length - 1 && (
                            <button disabled={isPending} onClick={() => move(c, FLOW[idx + 1])} title={`Advance to ${FLOW[idx + 1]}`} aria-label={`Advance ${c.name} to ${FLOW[idx + 1]}`} className="grid h-6 w-6 place-items-center rounded text-accent-hover hover:bg-accent-soft disabled:opacity-40">
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {stage === "Rejected" ? (
                            <button disabled={isPending} onClick={() => move(c, "Applied")} title="Reconsider (back to Applied)" className="rounded px-1.5 text-label-sm text-ink-faint hover:bg-bg hover:text-ink disabled:opacity-40">
                              Restore
                            </button>
                          ) : (
                            stage !== "Hired" && (
                              <button disabled={isPending} onClick={() => move(c, "Rejected")} title="Reject" aria-label={`Reject ${c.name}`} className="grid h-6 w-6 place-items-center rounded text-ink-faint hover:bg-critical/10 hover:text-critical disabled:opacity-40">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )
                          )}
                          <button disabled={isPending} onClick={() => remove(c)} title="Remove from pipeline" aria-label={`Remove ${c.name}`} className="grid h-6 w-6 place-items-center rounded text-ink-faint hover:bg-critical/10 hover:text-critical disabled:opacity-40">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}

                  {cards.length === 0 && <p className="rounded-lg border border-dashed border-border py-6 text-center text-body-sm text-ink-faint">No candidates</p>}

                  {cards.length > COLUMN_LIMIT && (
                    <button
                      onClick={() => setExpanded((e) => ({ ...e, [stage]: !open }))}
                      className="w-full rounded-md py-1.5 text-label-sm text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      {open ? "Show less" : `+ ${cards.length - COLUMN_LIMIT} more in ${stage.toLowerCase()}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Requisitions table ── */}
      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
          <h2 className="text-headline-md text-ink">Job Requisitions</h2>
          <Pill tone="accent">{openJobs.length} open</Pill>
          <span className="text-body-sm text-ink-faint">Every role, its pipeline and how long it has been open.</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] leading-[18px]">
            <thead>
              <tr className="border-b border-border text-label-sm uppercase tracking-[0.05em] text-ink-faint">
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Department</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Location</th>
                <th className="px-4 py-3 text-right font-medium">Applicants</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">In loop</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Open for</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const inLoop = j.candidates.filter((c) => c.stage === "Interview").length;
                const jobOffers = j.candidates.filter((c) => c.stage === "Offer").length;
                const daysOpen = Math.max(0, Math.round((nowMs - new Date(j.createdAt).getTime()) / DAY));
                return (
                  <tr key={j.id} className="h-16 border-b border-border last:border-0 hover:bg-surface-2">
                    <td className="px-5 py-3">
                      <button onClick={() => setJobFilter(j.id)} className="text-left" title="Filter the board to this role">
                        <p className="font-medium text-ink hover:text-accent-hover">{j.title}</p>
                        <p className="text-body-sm text-ink-faint">{j.type}</p>
                      </button>
                    </td>
                    <td className="hidden px-4 py-3 text-ink-muted md:table-cell">{j.department}</td>
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
                        <span className="tnum rounded-md bg-warning/10 px-2 py-0.5 text-label-sm text-warning">{jobOffers} offer{jobOffers === 1 ? "" : "s"} out</span>
                      ) : inLoop > 0 ? (
                        <span className="tnum rounded-md bg-accent-soft px-2 py-0.5 text-label-sm text-accent-hover">{inLoop} interviewing</span>
                      ) : (
                        <span className="text-body-sm text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="tnum hidden px-4 py-3 text-ink-muted md:table-cell">
                      {daysOpen} {daysOpen === 1 ? "day" : "days"}
                    </td>
                    <td className="px-4 py-3">
                      <JobStatusPill status={j.status} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setCandidateModal({ jobId: j.id, stage: "Applied" })}
                          aria-label={`Add candidate to ${j.title}`}
                          title="Add candidate"
                          className="grid h-7 w-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface hover:text-accent-hover"
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
                          className="grid h-7 w-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface hover:text-ink"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteJob(j)}
                          aria-label={`Delete ${j.title}`}
                          title="Delete role"
                          className="grid h-7 w-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-critical/10 hover:text-critical"
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
              <p className="text-headline-sm text-ink">No roles yet</p>
              <p className="mt-1 text-body-md text-ink-muted">Click “Post job” to open your first position.</p>
            </div>
          )}
        </div>
      </section>

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
