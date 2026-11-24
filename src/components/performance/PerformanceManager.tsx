"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Send, Undo2, Search, Download, Award, Check, Lock, Star, ChevronDown, Workflow, CircleCheck, Clock, type LucideIcon } from "lucide-react";
import { ratingLabel, periodSortKey, type ReviewRow, type ReviewInput, type PerfEmployee } from "@/lib/performance";
import { createReview, updateReview, setReviewStatus, deleteReview } from "@/lib/performance-actions";
import { deptBadgeClass } from "@/lib/dept-tint";
import ReviewFormModal from "./ReviewFormModal";
import Avatar from "./Avatar";
import Stars from "./Stars";
import ResponsiveList from "@/components/ui/ResponsiveList";
import ListRow from "@/components/ui/ListRow";
import FilterBar from "@/components/ui/FilterBar";
import BottomSheet from "@/components/ui/BottomSheet";
import EmptyState from "@/components/ui/EmptyState";
import StatusText, { type StatusTone } from "@/components/ui/StatusText";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form";
import ConfirmSheet, { type Confirmation } from "@/components/employees/ConfirmSheet";
import { ChipTabs } from "@/components/ui/Chips";
import Fab from "@/components/ui/Fab";

// Roster status for one employee in the chosen cycle.
type RosterStatus = "Not started" | "Draft" | "Submitted" | "Acknowledged";
type RosterRow = { emp: PerfEmployee; review: ReviewRow | null; status: RosterStatus };

const TABS: { key: "all" | RosterStatus | "shared"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "shared", label: "Shared" },
  { key: "Draft", label: "Draft" },
  { key: "Not started", label: "Not started" },
];
const PAGE_SIZES = [8, 16, 32];

// Bar colour per rating (1–5): navy for good ratings, amber/red for low.
const RATING_BAR: Record<number, string> = {
  5: "bg-navy",
  4: "bg-navy",
  3: "bg-ink-muted",
  2: "bg-warning",
  1: "bg-critical",
};

// Tile colour per rating in the "Talent by rating" grid (0 = not rated yet).
const RATING_TILE: Record<number, string> = {
  5: "bg-accent-soft border-accent",
  4: "bg-tint-sky border-border",
  3: "bg-tint-sand border-border",
  2: "bg-tint-peach border-border",
  1: "bg-tint-rose border-border",
  0: "bg-surface-2 border-border",
};

// `tone` + `icon` are the phone list's StatusText (icon + colour + words);
// `pill` + `dot` are the desktop table's badge.
const STATUS_STYLE: Record<RosterStatus, { pill: string; dot: string; label: string; tone: StatusTone; icon?: LucideIcon }> = {
  Acknowledged: { pill: "bg-good/15 text-good", dot: "bg-good", label: "Acknowledged", tone: "good" },
  Submitted: { pill: "bg-tint-sky text-ink", dot: "bg-navy", label: "Shared", tone: "pending", icon: Send },
  Draft: { pill: "bg-surface-2 text-ink-muted", dot: "bg-ink-faint", label: "Draft", tone: "neutral", icon: Pencil },
  "Not started": { pill: "bg-warning/15 text-warning", dot: "bg-warning", label: "Not started", tone: "warning", icon: Clock },
};

// Small controls in the desktop table: 32px to look at, but an invisible
// 48px hit area below lg (tablets are touch screens too).
const HIT = "relative before:absolute before:-inset-2 before:content-[''] lg:before:hidden";

const pagerButton =
  "inline-flex min-h-tap flex-1 items-center justify-center rounded-full border border-border bg-surface px-4 text-label-sm text-ink transition-colors hover:bg-bg disabled:opacity-40 md:flex-none md:px-3 lg:h-8 lg:min-h-0";

const avg = (ns: number[]) => (ns.length ? ns.reduce((s, n) => s + n, 0) / ns.length : 0);
const round2 = (n: number) => Math.round(n * 100) / 100;
const pctOf = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

// "2026-11-03T…" → "Nov 3, 2026" (read from the string so server & browser agree).
function fmtDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function PerformanceManager({ reviews, employees }: { reviews: ReviewRow[]; employees: PerfEmployee[] }) {
  const router = useRouter();

  // All cycles that have reviews, oldest → newest.
  const periods = [...new Set(reviews.map((r) => r.period))].sort((a, b) => periodSortKey(a) - periodSortKey(b) || a.localeCompare(b));
  const [period, setPeriod] = useState(periods[periods.length - 1] ?? "");
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [sort, setSort] = useState<"rating-desc" | "rating-asc" | "name">("rating-desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(8);
  const [modal, setModal] = useState<{ editing: ReviewRow | null; employeeId?: string } | null>(null);
  const [actionsFor, setActionsFor] = useState<RosterRow | null>(null); // phone: the row whose actions sheet is open
  const [confirm, setConfirm] = useState<Confirmation | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── This cycle ────────────────────────────────────────────────────
  const inCycle = reviews.filter((r) => r.period === period);
  // One review per employee (most recently updated wins).
  const latestByEmp = new Map<string, ReviewRow>();
  for (const r of inCycle) {
    const prev = latestByEmp.get(r.employeeId);
    if (!prev || r.updatedAt > prev.updatedAt) latestByEmp.set(r.employeeId, r);
  }
  const roster: RosterRow[] = employees.map((emp) => {
    const review = latestByEmp.get(emp.id) ?? null;
    return { emp, review, status: (review?.status as RosterStatus) ?? "Not started" };
  });
  const empById = new Map(employees.map((e) => [e.id, e]));

  const tally = { Draft: 0, Submitted: 0, Acknowledged: 0, "Not started": 0 } as Record<RosterStatus, number>;
  for (const r of roster) tally[r.status]++;
  const total = employees.length;
  const started = tally.Draft + tally.Submitted + tally.Acknowledged;
  const shared = tally.Submitted + tally.Acknowledged;
  const complete = pctOf(shared, total); // the headline "% complete" = reviews shared with the employee
  const ratings = [...latestByEmp.values()].map((r) => r.rating);
  const average = avg(ratings);

  const idx = periods.indexOf(period);
  const prevPeriod = idx > 0 ? periods[idx - 1] : null;
  const prevAvg = prevPeriod ? avg(reviews.filter((r) => r.period === prevPeriod).map((r) => r.rating)) : null;
  const avgDelta = prevAvg ? round2(average - prevAvg) : null;

  const departments = [...new Set(employees.map((e) => e.department).filter((d): d is string => !!d))].sort();

  // ── Pipeline steps (each is "how many of the team got this far") ──
  const steps = [
    { label: "Review written", done: started, note: "drafted" },
    { label: "Shared with employee", done: shared, note: "shared" },
    { label: "Acknowledged", done: tally.Acknowledged, note: "signed off" },
  ];
  // The current step is the first one that isn't finished.
  const currentStep = steps.findIndex((s) => s.done < total);

  // ── Distribution (5 → 1) ──────────────────────────────────────────
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: ratings.filter((r) => r === n).length }));
  const sorted = [...ratings].sort((a, b) => a - b);
  const median = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : null;
  const stdDev = ratings.length ? Math.sqrt(avg(ratings.map((r) => (r - average) ** 2))) : null;

  // ── "Talent by rating" tiles: people grouped by their rating ──────
  const tiles = [5, 4, 3, 2, 1, 0].map((n) => ({
    n,
    people: roster.filter((r) => (n === 0 ? !r.review : r.review?.rating === n)).map((r) => r.emp),
  }));

  // ── Department averages ───────────────────────────────────────────
  const deptAvgs = departments
    .map((d) => {
      const rs = roster.filter((r) => r.emp.department === d && r.review).map((r) => r.review!.rating);
      return { dept: d, avg: avg(rs), n: rs.length };
    })
    .filter((d) => d.n > 0)
    .sort((a, b) => b.avg - a.avg);

  // ── Recent written feedback (the "strengths" notes) ───────────────
  const notes = [...latestByEmp.values()]
    .filter((r) => r.strengths?.trim())
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);

  // ── Roster filtering ──────────────────────────────────────────────
  const q = query.trim().toLowerCase();
  const tabCount = (k: (typeof TABS)[number]["key"]) => (k === "all" ? roster.length : k === "shared" ? shared : tally[k as RosterStatus]);
  const filtered = roster
    .filter((r) => (tab === "all" ? true : tab === "shared" ? r.status === "Submitted" || r.status === "Acknowledged" : r.status === tab))
    .filter((r) => dept === "all" || r.emp.department === dept)
    .filter((r) => ratingFilter === "all" || String(r.review?.rating ?? "") === ratingFilter)
    .filter((r) => !q || r.emp.name.toLowerCase().includes(q) || r.emp.role.toLowerCase().includes(q) || (r.review?.reviewerName ?? "").toLowerCase().includes(q))
    .sort((a, b) =>
      sort === "name"
        ? a.emp.name.localeCompare(b.emp.name)
        : ((sort === "rating-desc" ? -1 : 1) * ((a.review?.rating ?? 0) - (b.review?.rating ?? 0))) || a.emp.name.localeCompare(b.emp.name),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * pageSize, current * pageSize + pageSize);
  const resetPage = () => setPage(0);

  // Clicking a rating tile filters the roster to that rating (or "not started").
  function pickTile(n: number) {
    if (n === 0) {
      setTab("Not started");
      setRatingFilter("all");
    } else {
      setTab("all");
      setRatingFilter(ratingFilter === String(n) ? "all" : String(n));
    }
    resetPage();
    document.getElementById("roster")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── Actions (permission re-checked on the server) ─────────────────
  function run(fn: () => Promise<void>, after?: () => void) {
    startTransition(async () => {
      try {
        await fn();
        after?.();
        router.refresh();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }
  const handleSave = (data: ReviewInput, id?: string) => {
    run(() => (id ? updateReview(id, data) : createReview(data)), () => {
      setModal(null);
      if (!id && data.period) setPeriod(data.period.trim()); // jump to the cycle you just added to
    });
  };
  const share = (r: ReviewRow, status: "Submitted" | "Draft") => run(() => setReviewStatus(r.id, status));
  function remove(r: ReviewRow) {
    setConfirm({
      title: "Delete this review?",
      message: `${r.employeeName}'s ${r.period} review will be permanently deleted.`,
      confirmLabel: "Delete review",
      danger: true,
      onConfirm: () => run(() => deleteReview(r.id)),
    });
  }

  function exportCsv() {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [
      ["Employee", "Role", "Department", "Cycle", "Reviewer", "Rating", "Rating label", "Status", "Strengths", "Goals"],
      ...roster.map((r) => [
        r.emp.name,
        r.emp.role,
        r.emp.department ?? "",
        period,
        r.review?.reviewerName ?? "",
        r.review?.rating ?? "",
        r.review ? ratingLabel(r.review.rating) : "",
        r.status,
        r.review?.strengths ?? "",
        r.review?.goals ?? "",
      ]),
    ];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `performance-${period.replace(/\s+/g, "-") || "reviews"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Filters that live in the phone "Filters" sheet (search stays visible).
  const sheetFilterCount = (dept !== "all" ? 1 : 0) + (ratingFilter !== "all" ? 1 : 0) + (sort !== "rating-desc" ? 1 : 0);
  function resetSheetFilters() {
    setDept("all");
    setRatingFilter("all");
    setSort("rating-desc");
    resetPage();
  }
  // Desktop keeps the compact 36px pill selects; phones/tablets get 48px fields.
  const control = `${inputClass} rounded-full md:w-auto lg:h-9 lg:min-h-0 lg:px-3 lg:text-label-md`;

  return (
    // Extra bottom room below lg so the floating "New review" button never covers the pager.
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* ── Header ── */}
      <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="min-w-0 space-y-2">
          <p className="flex flex-wrap items-center gap-2 text-eyebrow uppercase text-ink-muted">
            <span>{period ? `Cycle ${period}` : "Performance"}</span>
            <span className="h-1 w-1 rounded-full bg-ink-faint" />
            <span className="tnum">
              {shared} of {total} shared
            </span>
            {period && (
              <>
                <span className="h-1 w-1 rounded-full bg-accent" />
                <span className={complete === 100 ? "text-good" : "text-accent-ink"}>{complete === 100 ? "Complete" : "In progress"}</span>
              </>
            )}
          </p>
          <h1 className="max-w-2xl text-headline-lg text-ink md:text-headline-xl">
            {period ? `${period} reviews, ${complete}% complete.` : "No review cycles yet."}
          </h1>
          <p className="max-w-2xl text-body-md text-ink-muted">
            {isPending
              ? "Working…"
              : `Review progress, ratings and written feedback across ${total} team ${total === 1 ? "member" : "members"}.`}
          </p>
        </div>

        {/* Phones: cycle picker and Export stack full width. "New review" is the
            floating yellow button (Fab) below lg, so it only shows here on desktop. */}
        <div className="grid shrink-0 grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center">
          {periods.length > 0 && (
            <label className="relative">
              <span className="sr-only">Review cycle</span>
              <select
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                  resetPage();
                }}
                className="min-h-tap w-full appearance-none rounded-full border border-border bg-surface pl-4 pr-9 text-label-md text-ink outline-none transition-colors hover:bg-bg focus:border-ink sm:w-auto lg:h-10 lg:min-h-0"
              >
                {[...periods].reverse().map((p) => (
                  <option key={p} value={p}>
                    Cycle: {p}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            </label>
          )}
          <button onClick={exportCsv} disabled={!period} className={buttonClass("secondary")}>
            <Download className="h-4 w-4" aria-hidden />
            Export cycle report
          </button>
          <button onClick={() => setModal({ editing: null })} disabled={isPending || employees.length === 0} className={`${buttonClass("primary")} max-lg:hidden`}>
            <Plus className="h-4 w-4" aria-hidden />
            New review
          </button>
        </div>
      </section>

      {/* ── Review pipeline ── */}
      <section className="rounded-xl border border-border bg-surface p-4 md:p-6">
        <div className="flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-navy text-on-navy">
              <Workflow className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-headline-sm text-ink">Review pipeline</h2>
              <p className="text-body-sm text-ink-muted">How far this cycle has moved, from first draft to employee sign-off</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-surface-2 px-3 py-1.5 text-label-sm text-ink-muted sm:self-auto">
            <Clock className="h-3.5 w-3.5" />
            <span className="tnum font-bold text-ink">{tally["Not started"]} not started</span>
            <span className="h-1 w-1 rounded-full bg-ink-faint" />
            <span className="tnum">{tally.Draft} unshared drafts</span>
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {steps.map((s, i) => {
            const pct = pctOf(s.done, total);
            const isDone = total > 0 && s.done >= total;
            const isCurrent = i === currentStep;
            const isFuture = currentStep !== -1 && i > currentStep;
            return (
              <div
                key={s.label}
                className={[
                  "rounded-xl border p-4",
                  isCurrent ? "border-accent bg-accent-soft" : isFuture ? "border-border bg-surface-2" : "border-border bg-surface",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-eyebrow uppercase text-ink-muted">
                    Step 0{i + 1}
                    {isCurrent ? " · Current" : ""}
                  </p>
                  {isDone ? (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-navy text-on-navy">
                      <Check className="h-3 w-3" />
                    </span>
                  ) : isCurrent ? (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase text-on-accent">Active</span>
                  ) : (
                    <Lock className="h-4 w-4 text-ink-faint" />
                  )}
                </div>
                <p className={`mt-2 font-display text-headline-sm ${isFuture ? "text-ink-muted" : "text-ink"}`}>{s.label}</p>
                <p className="tnum text-body-sm text-ink-muted">
                  {s.done} / {total} {s.note}
                </p>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-bg">
                  <div className={`h-full rounded-full ${isCurrent ? "bg-accent" : "bg-navy"}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="tnum mt-2 text-eyebrow uppercase text-ink-muted">{pct}% of team</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Talent by rating ── */}
      <section className="rounded-xl border border-border bg-surface p-4 md:p-6">
        <div className="flex flex-col justify-between gap-2 border-b border-border pb-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-headline-md text-ink">Talent by rating</h2>
              {period && <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-label-sm text-ink-muted">{period}</span>}
            </div>
            <p className="text-body-sm text-ink-muted">Everyone on the team, grouped by this cycle&apos;s rating. Click a group to filter the roster.</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-label-sm text-ink-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent ring-1 ring-ink/30" />
              Rated 4–5 ({pctOf(dist[0].count + dist[1].count, ratings.length)}%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-navy" />
              Rated 3 ({pctOf(dist[2].count, ratings.length)}%)
            </span>
          </div>
        </div>

        {/* Two tiles per row even on phones: six full-width tiles would be a long scroll. */}
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {tiles.map(({ n, people }) => {
            const active = n === 0 ? tab === "Not started" : ratingFilter === String(n);
            return (
              <button
                key={n}
                onClick={() => pickTile(n)}
                className={[
                  "relative flex min-h-32 min-w-0 flex-col justify-between overflow-hidden rounded-xl border p-3 text-left sm:p-4 transition-colors hover:border-ink/40",
                  RATING_TILE[n],
                  active ? "ring-2 ring-ink" : "",
                ].join(" ")}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="flex min-w-0 items-center gap-1.5 text-eyebrow uppercase text-ink">
                    {n === 5 && <Star className="h-3.5 w-3.5 shrink-0 fill-accent text-accent-ink" aria-hidden />}
                    {n === 0 ? "Not rated yet" : ratingLabel(n)}
                  </p>
                  <span className={`tnum shrink-0 rounded-full px-2 py-0.5 text-label-sm font-bold ${n === 5 ? "bg-accent text-on-accent" : "bg-surface text-ink"}`}>
                    {people.length}
                  </span>
                </div>
                <div className="mt-3 flex items-center">
                  {people.slice(0, 4).map((p) => (
                    <span key={p.id} className="-ml-1.5 rounded-full ring-2 ring-surface first:ml-0">
                      <Avatar name={p.name} department={p.department} size={28} />
                    </span>
                  ))}
                  {people.length > 4 && (
                    <span className="tnum -ml-1.5 grid h-7 min-w-7 place-items-center rounded-full bg-surface px-1.5 text-[10px] font-bold text-ink ring-2 ring-surface">
                      +{people.length - 4}
                    </span>
                  )}
                  {people.length === 0 && <span className="text-body-sm text-ink-muted">Nobody</span>}
                </div>
                <p className="mt-3 text-eyebrow uppercase text-ink-muted">
                  {n === 0 ? "No review this cycle" : `Rated ${n} of 5`}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Roster + right rail ── */}
      <section className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div id="roster" className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface xl:col-span-8">
          <div className="flex flex-col gap-3 border-b border-border p-4 md:p-5">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <div className="min-w-0">
                <h2 className="text-headline-sm text-ink">Review roster</h2>
                <p className="text-body-sm text-ink-muted">Each person&apos;s review status and rating for this cycle</p>
              </div>
              {/* Phones/tablets: the shared swipeable chip row (navy when chosen,
                  48px tap area). Desktop keeps its compact navy pills. */}
              <ChipTabs
                label="Filter by review status"
                className="lg:hidden"
                options={TABS.map((t) => ({ key: t.key, label: t.label, count: tabCount(t.key) }))}
                value={tab}
                onChange={(k) => {
                  setTab(k as (typeof TABS)[number]["key"]);
                  resetPage();
                }}
              />
              <div className="hidden flex-wrap items-center gap-1.5 lg:flex" role="tablist" aria-label="Review status">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={tab === t.key}
                    onClick={() => {
                      setTab(t.key);
                      resetPage();
                    }}
                    className={[
                      "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-label-sm font-semibold transition-colors",
                      tab === t.key ? "bg-navy text-on-navy" : "bg-surface-2 text-ink-muted hover:text-ink",
                    ].join(" ")}
                  >
                    {t.label}
                    <span className="tnum">({tabCount(t.key)})</span>
                  </button>
                ))}
              </div>
            </div>

            <FilterBar
              activeCount={sheetFilterCount}
              onReset={resetSheetFilters}
              search={
                <div className="relative w-full md:min-w-56">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
                  <input
                    type="search"
                    autoComplete="off"
                    enterKeyHint="search"
                    aria-label="Filter the roster"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      resetPage();
                    }}
                    placeholder="Filter by name, role or reviewer…"
                    className={`${control} pl-9 lg:pl-9`}
                  />
                </div>
              }
            >
              <select aria-label="Department" value={dept} onChange={(e) => { setDept(e.target.value); resetPage(); }} className={control}>
                <option value="all">All departments</option>
                {departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select aria-label="Rating" value={ratingFilter} onChange={(e) => { setRatingFilter(e.target.value); resetPage(); }} className={control}>
                <option value="all">Any rating</option>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={String(n)}>
                    {n} · {ratingLabel(n)}
                  </option>
                ))}
              </select>
              <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={control}>
                <option value="rating-desc">Rating: high first</option>
                <option value="rating-asc">Rating: low first</option>
                <option value="name">Name</option>
              </select>
            </FilterBar>
          </div>

          {/* md+: a table. Phones: one row per person (avatar, name, department +
              rating word, stars, status); tapping a row opens its actions sheet. */}
          <ResponsiveList<RosterRow>
            inset
            caption="Review roster"
            rows={visible}
            getKey={(r) => r.emp.id}
            listClassName="px-4"
            empty={
              <EmptyState
                icon={Award}
                title={periods.length ? "Nobody matches" : "No reviews yet"}
                description={periods.length ? "Try another tab or filter." : "Tap “New review” to start your first cycle."}
              />
            }
            columns={[
              {
                key: "employee",
                header: "Employee",
                cell: ({ emp }) => (
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={emp.name} department={emp.department} size={32} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{emp.name}</p>
                      <p className="truncate text-body-sm text-ink-muted">{emp.role}</p>
                    </div>
                  </div>
                ),
              },
              {
                key: "department",
                header: "Department",
                className: "hidden lg:table-cell",
                headerClassName: "hidden lg:table-cell",
                cell: ({ emp }) =>
                  emp.department ? <span className={deptBadgeClass(emp.department)}>{emp.department}</span> : <span className="text-ink-faint">—</span>,
              },
              {
                key: "reviewer",
                header: "Reviewer",
                cell: ({ review }) =>
                  review ? (
                    <span className="flex min-w-0 items-center gap-2 text-body-sm text-ink">
                      <Avatar name={review.reviewerName} department={null} size={22} />
                      <span className="truncate">{review.reviewerName}</span>
                    </span>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  ),
              },
              {
                key: "status",
                header: "Status",
                cell: ({ status }) => {
                  const st = STATUS_STYLE[status];
                  return (
                    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-label-sm font-semibold ${st.pill}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} aria-hidden />
                      {st.label}
                    </span>
                  );
                },
              },
              {
                key: "rating",
                header: "Rating",
                cell: ({ review }) =>
                  review ? (
                    <div className="flex items-center gap-2" title={ratingLabel(review.rating)}>
                      <span className="tnum w-7 font-bold text-ink">{review.rating}.0</span>
                      <span className="sr-only">{ratingLabel(review.rating)}</span>
                      <span aria-hidden className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-2">
                        <span className={`block h-full rounded-full ${RATING_BAR[review.rating] ?? "bg-navy"}`} style={{ width: `${(review.rating / 5) * 100}%` }} />
                      </span>
                    </div>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  ),
              },
              {
                key: "actions",
                header: "Actions",
                align: "right",
                cell: ({ emp, review }) => (
                  // gap-4 below lg keeps the invisible 48px hit areas from overlapping.
                  <div className="flex items-center justify-end gap-4 lg:gap-1">
                    {!review ? (
                      <button
                        onClick={() => setModal({ editing: null, employeeId: emp.id })}
                        disabled={isPending}
                        className={`${HIT} inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full border border-border bg-surface px-3 text-label-sm text-ink transition-colors hover:bg-bg disabled:opacity-50`}
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden /> Start review
                      </button>
                    ) : (
                      <>
                        {review.status === "Draft" && (
                          <IconBtn label="Share with employee" onClick={() => share(review, "Submitted")} disabled={isPending} tone="accent">
                            <Send className="h-3.5 w-3.5" aria-hidden />
                          </IconBtn>
                        )}
                        {review.status === "Submitted" && (
                          <IconBtn label="Move back to draft" onClick={() => share(review, "Draft")} disabled={isPending}>
                            <Undo2 className="h-3.5 w-3.5" aria-hidden />
                          </IconBtn>
                        )}
                        <IconBtn label="Edit review" onClick={() => setModal({ editing: review })} disabled={isPending}>
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </IconBtn>
                        <IconBtn label="Delete review" onClick={() => remove(review)} disabled={isPending} tone="danger">
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </IconBtn>
                      </>
                    )}
                  </div>
                ),
              },
            ]}
            renderRow={(row) => {
              const { emp, review, status } = row;
              const st = STATUS_STYLE[status];
              return (
                <ListRow
                  onClick={() => setActionsFor(row)}
                  label={`${emp.name}, ${st.label}${review ? `, rated ${review.rating} of 5` : ""}. Open review actions`}
                  leading={<Avatar name={emp.name} department={emp.department} size={40} />}
                  title={emp.name}
                  subtitle={[emp.department ?? emp.role, review ? ratingLabel(review.rating) : null].filter(Boolean).join(" · ")}
                  meta={review ? <Stars rating={review.rating} small /> : <span className="text-ink-faint">Not rated</span>}
                  trailing={
                    <StatusText tone={st.tone} icon={st.icon} className="text-label-sm">
                      {st.label}
                    </StatusText>
                  }
                />
              );
            }}
          />

          <div className="flex flex-col items-stretch justify-between gap-3 border-t border-border px-4 py-3 text-body-sm text-ink-muted sm:flex-row sm:items-center md:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-start">
              <span className="tnum">
                Showing {filtered.length ? `${current * pageSize + 1}–${current * pageSize + visible.length}` : 0} of {filtered.length}
              </span>
              <label className="flex items-center gap-2">
                Rows
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    resetPage();
                  }}
                  className="min-h-tap rounded-full border border-border bg-surface px-3 text-label-sm text-ink outline-none lg:h-7 lg:min-h-0 lg:px-2"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {/* Phones: Previous / Next stretch to share the row (big thumb targets). */}
            <nav aria-label="Roster pages" className="flex items-center gap-2">
              <button disabled={current === 0} onClick={() => setPage(current - 1)} className={pagerButton}>
                Previous
              </button>
              <span className="tnum shrink-0 px-1 text-label-sm text-ink">
                {current + 1} / {pages}
              </span>
              <button
                disabled={current >= pages - 1}
                onClick={() => setPage(current + 1)}
                className={`${pagerButton} border-navy bg-navy font-semibold text-on-navy hover:bg-navy-2`}
              >
                Next
              </button>
            </nav>
          </div>
        </div>

        {/* ── Right rail ── */}
        <div className="space-y-6 xl:col-span-4">
          {/* Rating distribution */}
          <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
              <div>
                <p className="text-eyebrow uppercase text-ink-muted">This cycle</p>
                <h2 className="text-headline-sm text-ink">Rating distribution</h2>
              </div>
              <div className="text-right">
                <p className="text-eyebrow uppercase text-ink-muted">Average</p>
                <p className="tnum text-metric-md text-ink">
                  {ratings.length ? average.toFixed(1) : "—"}
                  <span className="ml-1 text-body-sm font-normal text-ink-muted">/ 5</span>
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3.5">
              {dist.map(({ n, count }) => {
                const share = ratings.length ? (count / ratings.length) * 100 : 0;
                return (
                  <div key={n}>
                    <div className="flex items-center justify-between gap-3 text-body-sm">
                      <span className="text-ink">
                        {n} · {ratingLabel(n)}
                      </span>
                      <span className="tnum text-ink-muted">
                        {Math.round(share)}% ({count})
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className={`h-full rounded-full ${n === 5 ? "bg-accent" : RATING_BAR[n]}`} style={{ width: `${share}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-body-sm text-ink-muted">
              <span className="flex items-center gap-1.5">
                <CircleCheck className="h-4 w-4 text-accent-ink" />
                Median <span className="tnum font-semibold text-ink">{median !== null ? median.toFixed(1) : "—"}</span>
                <span className="text-ink-faint">·</span>σ <span className="tnum font-semibold text-ink">{stdDev !== null ? stdDev.toFixed(2) : "—"}</span>
              </span>
              <span className="tnum">
                {avgDelta !== null ? `${avgDelta >= 0 ? "+" : "−"}${Math.abs(avgDelta).toFixed(2)} vs ${prevPeriod}` : "No earlier cycle"}
              </span>
            </div>
          </section>

          {/* Department averages */}
          <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
            <p className="text-eyebrow uppercase text-ink-muted">By department</p>
            <h2 className="text-headline-sm text-ink">Average rating</h2>
            <div className="mt-4 space-y-3">
              {deptAvgs.map((d) => (
                <div key={d.dept}>
                  <div className="flex items-center justify-between gap-2 text-body-sm">
                    <span className="truncate text-ink">{d.dept}</span>
                    <span className="tnum shrink-0 text-ink-muted">
                      <span className="font-bold text-ink">{d.avg.toFixed(2)}</span> · {d.n} {d.n === 1 ? "review" : "reviews"}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-navy" style={{ width: `${(d.avg / 5) * 100}%` }} />
                  </div>
                </div>
              ))}
              {deptAvgs.length === 0 && <p className="py-6 text-center text-body-md text-ink-muted">No ratings in this cycle yet.</p>}
            </div>
          </section>

          {/* Recent written feedback */}
          <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-eyebrow uppercase text-ink-muted">Written feedback</p>
                <h2 className="text-headline-sm text-ink">Recent strengths notes</h2>
              </div>
              {notes.length > 0 && <span className="h-2 w-2 rounded-full bg-accent ring-1 ring-ink/30" />}
            </div>
            <div className="mt-4 space-y-3">
              {notes.map((r) => (
                <figure key={r.id} className="rounded-lg border border-border p-4">
                  <blockquote className="line-clamp-4 text-body-sm italic text-ink">&ldquo;{r.strengths}&rdquo;</blockquote>
                  <figcaption className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar name={r.reviewerName} department={null} size={26} />
                      <span className="min-w-0">
                        <span className="block truncate text-label-sm font-semibold text-ink">{r.reviewerName}</span>
                        <span className="block truncate text-label-sm text-ink-muted">on {r.employeeName}{empById.get(r.employeeId)?.department ? ` · ${empById.get(r.employeeId)?.department}` : ""}</span>
                      </span>
                    </span>
                    <span className="tnum shrink-0 text-label-sm text-ink-muted">{fmtDate(r.updatedAt)}</span>
                  </figcaption>
                </figure>
              ))}
              {notes.length === 0 && <p className="py-6 text-center text-body-md text-ink-muted">No written notes in this cycle yet.</p>}
            </div>
          </section>
        </div>
      </section>

      <ReviewFormModal
        open={modal !== null}
        editing={modal?.editing ?? null}
        employees={employees}
        defaultEmployeeId={modal?.employeeId}
        defaultPeriod={period}
        onClose={() => setModal(null)}
        onSave={handleSave}
      />

      {employees.length > 0 && <Fab label="New review" icon={<Plus className="h-5 w-5" />} onClick={() => setModal({ editing: null })} />}

      {/* Phones: tapping a roster row opens that person's actions here. */}
      <RowActionsSheet
        row={actionsFor}
        period={period}
        disabled={isPending}
        onClose={() => setActionsFor(null)}
        onStart={(emp) => setModal({ editing: null, employeeId: emp.id })}
        onShare={share}
        onEdit={(r) => setModal({ editing: r })}
        onDelete={remove}
      />
      <ConfirmSheet confirmation={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

/*
  The phone version of the roster's action buttons: a bottom sheet with
  full-width 48px buttons. Each button closes the sheet, then acts.
  We keep the last row on screen while the sheet slides away.
*/
function RowActionsSheet({
  row,
  period,
  disabled,
  onClose,
  onStart,
  onShare,
  onEdit,
  onDelete,
}: {
  row: RosterRow | null;
  period: string;
  disabled: boolean;
  onClose: () => void;
  onStart: (emp: PerfEmployee) => void;
  onShare: (r: ReviewRow, status: "Submitted" | "Draft") => void;
  onEdit: (r: ReviewRow) => void;
  onDelete: (r: ReviewRow) => void;
}) {
  const [last, setLast] = useState(row);
  if (row && row !== last) setLast(row);
  const r = row ?? last;
  const review = r?.review ?? null;
  const st = r ? STATUS_STYLE[r.status] : null;
  const act = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return (
    <BottomSheet
      open={row !== null}
      onClose={onClose}
      eyebrow={period ? `Cycle ${period}` : undefined}
      title={r?.emp.name ?? ""}
      description={[r?.emp.role, r?.emp.department].filter(Boolean).join(" · ")}
    >
      {r && st && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-sunken p-3">
            <StatusText tone={st.tone} icon={st.icon} variant="pill">
              {st.label}
            </StatusText>
            {review ? (
              <span className="flex items-center gap-2 text-body-sm text-ink-muted">
                <Stars rating={review.rating} />
                {ratingLabel(review.rating)}
              </span>
            ) : (
              <span className="text-body-sm text-ink-muted">Not rated yet</span>
            )}
          </div>
          {review && <p className="text-body-sm text-ink-muted">Reviewed by {review.reviewerName}</p>}

          <div className="flex flex-col gap-2">
            {!review ? (
              <button type="button" disabled={disabled} onClick={act(() => onStart(r.emp))} className={buttonClass("primary", { block: true })}>
                <Plus className="h-4 w-4" aria-hidden /> Start review
              </button>
            ) : (
              <>
                {review.status === "Draft" && (
                  <button type="button" disabled={disabled} onClick={act(() => onShare(review, "Submitted"))} className={buttonClass("primary", { block: true })}>
                    <Send className="h-4 w-4" aria-hidden /> Share with employee
                  </button>
                )}
                {review.status === "Submitted" && (
                  <button type="button" disabled={disabled} onClick={act(() => onShare(review, "Draft"))} className={buttonClass("secondary", { block: true })}>
                    <Undo2 className="h-4 w-4" aria-hidden /> Move back to draft
                  </button>
                )}
                <button type="button" disabled={disabled} onClick={act(() => onEdit(review))} className={buttonClass("secondary", { block: true })}>
                  <Pencil className="h-4 w-4" aria-hidden /> Edit review
                </button>
                <button type="button" disabled={disabled} onClick={act(() => onDelete(review))} className={buttonClass("danger", { block: true })}>
                  <Trash2 className="h-4 w-4" aria-hidden /> Delete review
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

// Small round icon button used in the roster's action column (32px, with an
// invisible 48px hit area below lg).
function IconBtn({
  label,
  onClick,
  disabled,
  tone,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "accent" | "danger";
  children: React.ReactNode;
}) {
  const hover = tone === "accent" ? "hover:bg-accent-soft hover:text-accent-ink" : tone === "danger" ? "hover:bg-critical/10 hover:text-critical" : "hover:bg-surface-2 hover:text-ink";
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label} className={`${HIT} grid h-8 w-8 place-items-center rounded-full text-ink-muted transition-colors ${hover} disabled:opacity-50`}>
      {children}
    </button>
  );
}
