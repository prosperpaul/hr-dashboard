"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Send, Undo2, Search, Download, Award } from "lucide-react";
import { initialsOf } from "@/lib/sample-data";
import { ratingLabel, periodSortKey, type ReviewRow, type ReviewInput, type PerfEmployee } from "@/lib/performance";
import { createReview, updateReview, setReviewStatus, deleteReview } from "@/lib/performance-actions";
import StatCard, { type DashStat } from "@/components/dashboard/StatCard";
import { Pill } from "@/components/dashboard/Panel";
import ReviewFormModal from "./ReviewFormModal";

// Roster status for one employee in the chosen cycle.
type RosterStatus = "Not started" | "Draft" | "Submitted" | "Acknowledged";
type RosterRow = { emp: PerfEmployee; review: ReviewRow | null; status: RosterStatus };

const TABS: { key: "all" | RosterStatus | "shared"; label: string }[] = [
  { key: "all", label: "All employees" },
  { key: "shared", label: "Shared" },
  { key: "Draft", label: "Draft" },
  { key: "Not started", label: "Not started" },
];
const PAGE_SIZES = [8, 16, 32];

// Colour per rating (1–5): emerald for high, amber/red for low.
const RATING_STYLE: Record<number, { bar: string; pill: string }> = {
  5: { bar: "bg-accent", pill: "border-accent/30 bg-accent-soft text-accent-hover" },
  4: { bar: "bg-accent/70", pill: "border-accent/20 bg-accent/5 text-accent-hover" },
  3: { bar: "bg-ink-muted", pill: "border-border bg-white/[0.04] text-ink-muted" },
  2: { bar: "bg-warning", pill: "border-warning/30 bg-warning/10 text-warning" },
  1: { bar: "bg-critical", pill: "border-critical/30 bg-critical/10 text-critical" },
};

const STATUS_STYLE: Record<RosterStatus, { pill: string; dot: string; label: string }> = {
  Acknowledged: { pill: "border-accent/25 bg-accent-soft text-accent-hover", dot: "bg-accent", label: "Acknowledged" },
  Submitted: { pill: "border-sky-400/30 bg-sky-400/10 text-sky-300", dot: "bg-sky-400", label: "Shared" },
  Draft: { pill: "border-border bg-white/[0.04] text-ink-muted", dot: "bg-ink-faint", label: "Draft" },
  "Not started": { pill: "border-warning/30 bg-warning/10 text-warning", dot: "bg-warning", label: "Not started" },
};

const avg = (ns: number[]) => (ns.length ? ns.reduce((s, n) => s + n, 0) / ns.length : 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

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

  const tally = { Draft: 0, Submitted: 0, Acknowledged: 0, "Not started": 0 } as Record<RosterStatus, number>;
  for (const r of roster) tally[r.status]++;
  const shared = tally.Submitted + tally.Acknowledged;
  const ratings = [...latestByEmp.values()].map((r) => r.rating);
  const average = avg(ratings);

  const idx = periods.indexOf(period);
  const prevPeriod = idx > 0 ? periods[idx - 1] : null;
  const prevAvg = prevPeriod ? avg(reviews.filter((r) => r.period === prevPeriod).map((r) => r.rating)) : null;
  const avgDelta = prevAvg ? round2(average - prevAvg) : null;
  const cycleAverages = periods.map((p) => round2(avg(reviews.filter((r) => r.period === p).map((r) => r.rating))));

  const top = roster.filter((r) => (r.review?.rating ?? 0) >= 4);
  const departments = [...new Set(employees.map((e) => e.department).filter((d): d is string => !!d))].sort();

  const stats: DashStat[] = [
    {
      key: "progress",
      label: "Review cycle progress",
      value: `${employees.length ? Math.round((shared / employees.length) * 100) : 0}%`,
      side: <span className="mb-1 mr-auto ml-2 text-body-sm text-ink-faint">{shared} of {employees.length} shared</span>,
      bar: [
        { value: tally.Acknowledged, className: "bg-accent" },
        { value: tally.Submitted, className: "bg-sky-400" },
        { value: tally.Draft, className: "bg-ink-faint/50" },
        { value: tally["Not started"], className: "bg-transparent" },
      ],
      footer: { label: `Acknowledged ${tally.Acknowledged} · Shared ${tally.Submitted}`, value: `Draft ${tally.Draft}` },
    },
    {
      key: "avg",
      label: "Average rating",
      value: ratings.length ? average.toFixed(2) : "—",
      side: <span className="mb-1 mr-auto ml-1.5 text-body-md text-ink-faint">/ 5</span>,
      badge:
        avgDelta !== null && avgDelta !== 0
          ? { text: `${avgDelta > 0 ? "+" : "−"}${Math.abs(avgDelta)} vs ${prevPeriod}`, trend: avgDelta > 0 ? "up" : "down", tone: avgDelta > 0 ? "accent" : "neutral" }
          : undefined,
      spark: cycleAverages.length >= 2 ? cycleAverages : undefined,
      footer: { label: "Reviews this cycle", value: String(ratings.length) },
    },
    {
      key: "top",
      label: "Top performers",
      value: String(top.length),
      side: <span className="mb-1 mr-auto ml-2 text-body-sm text-ink-faint">rated 4 or 5</span>,
      badge: ratings.length ? { text: `${Math.round((top.length / ratings.length) * 100)}% of reviewed`, tone: "neutral" } : undefined,
      footer: {
        label: "Outstanding (5)",
        value: `${roster.filter((r) => r.review?.rating === 5).length} people`,
        accent: true,
      },
    },
    {
      key: "bottlenecks",
      label: "Review bottlenecks",
      value: String(tally.Draft + tally["Not started"]),
      badge: tally.Draft + tally["Not started"] > 0 ? { text: "Requires triage", tone: "neutral", dot: true } : { text: "All done", tone: "accent" },
      footer: { label: `${tally.Draft} unshared drafts`, value: `${tally["Not started"]} not started` },
    },
  ];

  // ── Distribution (5 → 1) ──────────────────────────────────────────
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: ratings.filter((r) => r === n).length }));
  const sorted = [...ratings].sort((a, b) => a - b);
  const median = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : null;
  const stdDev = ratings.length ? Math.sqrt(avg(ratings.map((r) => (r - average) ** 2))) : null;

  // ── Department averages ───────────────────────────────────────────
  const deptAvgs = departments
    .map((d) => {
      const rs = roster.filter((r) => r.emp.department === d && r.review).map((r) => r.review!.rating);
      return { dept: d, avg: avg(rs), n: rs.length };
    })
    .filter((d) => d.n > 0)
    .sort((a, b) => b.avg - a.avg);

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
    if (window.confirm(`Delete ${r.employeeName}'s ${r.period} review?`)) run(() => deleteReview(r.id));
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

  const control =
    "h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-label-md text-ink outline-none transition-colors hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent";

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-label-sm uppercase tracking-wider text-ink-faint">
            <span>Operations</span>
            <span>/</span>
            <span className="normal-case tracking-normal text-ink-muted">Performance &amp; Growth</span>
          </div>
          <h1 className="text-headline-lg text-ink md:text-headline-xl">Performance Reviews</h1>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {periods.length > 0 ? (
              <label className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent-soft py-0.5 pl-2.5 pr-1 text-label-sm text-accent-hover">
                <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
                Cycle
                <select
                  aria-label="Review cycle"
                  value={period}
                  onChange={(e) => {
                    setPeriod(e.target.value);
                    resetPage();
                  }}
                  className="rounded-full bg-bg/60 px-2 py-0.5 text-label-sm text-ink outline-none"
                >
                  {[...periods].reverse().map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <Pill>No review cycles yet</Pill>
            )}
            <span className="text-body-sm text-ink-faint">{isPending ? "Working…" : `${shared} of ${employees.length} reviews shared`}</span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={!period}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 text-label-md text-ink transition-colors hover:border-border-strong hover:bg-white/[0.03] disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={() => setModal({ editing: null })}
            disabled={isPending || employees.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-label-md font-semibold text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] transition-colors hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            New review
          </button>
        </div>
      </section>

      {/* ── KPI cards ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.key} stat={s} />
        ))}
      </section>

      {/* ── Distribution + department averages ── */}
      <section className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="rounded-xl border border-border bg-surface p-5 xl:col-span-7">
          <h2 className="text-headline-md text-ink">Rating Distribution</h2>
          <p className="text-body-sm text-ink-faint">How this cycle&apos;s {ratings.length} ratings spread across the 1–5 scale (drafts included)</p>

          <div className="mt-5 space-y-4">
            {dist.map(({ n, count }) => {
              const share = ratings.length ? (count / ratings.length) * 100 : 0;
              return (
                <div key={n}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-label-md">
                    <span className="flex items-center gap-2 text-ink">
                      <span className={`h-1.5 w-1.5 rounded-full ${RATING_STYLE[n].bar}`} />
                      {n} · {ratingLabel(n)}
                    </span>
                    <span className="tnum text-label-sm text-ink-faint">
                      <span className="text-ink">{Math.round(share)}%</span> · {count} {count === 1 ? "person" : "people"}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-bg">
                    <div className={`h-full rounded-full ${RATING_STYLE[n].bar}`} style={{ width: `${share}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { label: "Median rating", value: median !== null ? median.toFixed(1) : "—" },
              { label: "Std deviation", value: stdDev !== null ? `${stdDev.toFixed(2)} σ` : "—" },
              {
                label: prevPeriod ? `Change vs ${prevPeriod}` : "Change vs last cycle",
                value: avgDelta !== null ? `${avgDelta >= 0 ? "+" : "−"}${Math.abs(avgDelta).toFixed(2)}` : "—",
                accent: (avgDelta ?? 0) > 0,
              },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-border bg-bg/50 p-3">
                <p className="text-label-sm text-ink-faint">{s.label}</p>
                <p className={`tnum mt-1 text-headline-sm font-medium ${s.accent ? "text-accent-hover" : "text-ink"}`}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 xl:col-span-5">
          <h2 className="text-headline-md text-ink">Department Averages</h2>
          <p className="text-body-sm text-ink-faint">Average rating per department this cycle</p>
          <div className="mt-4 space-y-2.5">
            {deptAvgs.map((d) => (
              <div key={d.dept} className="rounded-lg border border-border bg-surface-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-label-md text-ink">{d.dept}</span>
                  <span className="tnum text-label-md text-accent-hover">{d.avg.toFixed(2)}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(d.avg / 5) * 100}%` }} />
                </div>
                <p className="mt-1.5 text-body-sm text-ink-faint">
                  {d.n} {d.n === 1 ? "review" : "reviews"}
                </p>
              </div>
            ))}
            {deptAvgs.length === 0 && <p className="py-8 text-center text-body-md text-ink-muted">No ratings in this cycle yet.</p>}
          </div>
        </div>
      </section>

      {/* ── Roster ── */}
      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex flex-col gap-3 border-b border-border p-4 xl:flex-row xl:items-center">
          <div className="flex rounded-lg border border-border bg-bg p-0.5" role="tablist">
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
                  "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-label-sm transition-colors",
                  tab === t.key ? "bg-surface-2 text-ink" : "text-ink-faint hover:text-ink",
                ].join(" ")}
              >
                {t.label}
                <span className={`tnum text-[10px] ${t.key === "Not started" && tabCount(t.key) > 0 ? "text-warning" : "text-ink-faint"}`}>{tabCount(t.key)}</span>
              </button>
            ))}
          </div>

          <div className="flex flex-1 flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  resetPage();
                }}
                placeholder="Filter by name, role or reviewer…"
                className="h-9 w-full rounded-lg border border-border bg-surface-2 pl-8 pr-3 text-body-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </div>
            <select aria-label="Department" value={dept} onChange={(e) => { setDept(e.target.value); resetPage(); }} className={control}>
              <option value="all">Dept: All</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select aria-label="Rating" value={ratingFilter} onChange={(e) => { setRatingFilter(e.target.value); resetPage(); }} className={control}>
              <option value="all">Rating: All</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={String(n)}>
                  {n} · {ratingLabel(n)}
                </option>
              ))}
            </select>
            <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={control}>
              <option value="rating-desc">Sort: Rating (high)</option>
              <option value="rating-asc">Sort: Rating (low)</option>
              <option value="name">Sort: Name</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] leading-[18px]">
            <thead>
              <tr className="border-b border-border text-label-sm uppercase tracking-[0.05em] text-ink-faint">
                <th className="px-5 py-3 font-medium">Employee</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell">Department</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Reviewer</th>
                <th className="px-4 py-3 font-medium">Rating</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Updated</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(({ emp, review, status }) => {
                const st = STATUS_STYLE[status];
                return (
                  <tr key={emp.id} className="h-14 border-b border-border last:border-0 hover:bg-surface-2">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent-hover">
                          {initialsOf(emp.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">{emp.name}</p>
                          <p className="truncate text-body-sm text-ink-faint">{emp.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-4 py-2.5 text-ink-muted lg:table-cell">{emp.department ?? "—"}</td>
                    <td className="hidden px-4 py-2.5 md:table-cell">
                      {review ? (
                        <span className="flex items-center gap-2 text-ink-muted">
                          <span className="grid h-6 w-6 place-items-center rounded-full bg-surface-2 text-[9px] font-semibold text-ink-muted">
                            {initialsOf(review.reviewerName)}
                          </span>
                          {review.reviewerName}
                        </span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {review ? (
                        <div className="flex items-center gap-2">
                          <span className="tnum rounded-md border border-border bg-bg px-1.5 py-0.5 text-label-md text-ink">{review.rating}.0</span>
                          <span className={`hidden whitespace-nowrap rounded-full border px-2 py-0.5 text-label-sm sm:inline ${RATING_STYLE[review.rating]?.pill ?? ""}`}>
                            {ratingLabel(review.rating)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-label-sm ${st.pill}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                        {st.label}
                      </span>
                    </td>
                    <td className="tnum hidden px-4 py-2.5 text-ink-faint sm:table-cell">
                      {review ? new Date(review.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </td>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {!review ? (
                          <button
                            onClick={() => setModal({ editing: null, employeeId: emp.id })}
                            disabled={isPending}
                            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-label-sm text-ink-muted transition-colors hover:border-accent/50 hover:text-accent-hover disabled:opacity-50"
                          >
                            <Plus className="h-3 w-3" /> Start review
                          </button>
                        ) : (
                          <>
                            {review.status === "Draft" && (
                              <IconBtn label="Share with employee" onClick={() => share(review, "Submitted")} disabled={isPending} tone="accent">
                                <Send className="h-3.5 w-3.5" />
                              </IconBtn>
                            )}
                            {review.status === "Submitted" && (
                              <IconBtn label="Move back to draft" onClick={() => share(review, "Draft")} disabled={isPending}>
                                <Undo2 className="h-3.5 w-3.5" />
                              </IconBtn>
                            )}
                            <IconBtn label="Edit review" onClick={() => setModal({ editing: review })} disabled={isPending}>
                              <Pencil className="h-3.5 w-3.5" />
                            </IconBtn>
                            <IconBtn label="Delete review" onClick={() => remove(review)} disabled={isPending} tone="danger">
                              <Trash2 className="h-3.5 w-3.5" />
                            </IconBtn>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {visible.length === 0 && (
            <div className="grid place-items-center py-14 text-center">
              <div>
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface-2">
                  <Award className="h-5 w-5 text-ink-faint" />
                </div>
                <p className="mt-3 text-headline-sm text-ink">{periods.length ? "Nobody matches" : "No reviews yet"}</p>
                <p className="mt-1 text-body-md text-ink-muted">{periods.length ? "Try another tab or filter." : "Click “New review” to start your first cycle."}</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-5 py-3 text-body-sm text-ink-faint sm:flex-row">
          <div className="flex items-center gap-3">
            <span className="tnum">
              Showing {filtered.length ? `${current * pageSize + 1}–${current * pageSize + visible.length}` : 0} of {filtered.length}
            </span>
            <label className="flex items-center gap-2">
              Rows per page
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  resetPage();
                }}
                className="h-7 rounded-md border border-border bg-surface-2 px-1.5 text-label-sm text-ink outline-none"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button disabled={current === 0} onClick={() => setPage(current - 1)} className="rounded-md border border-border px-2.5 py-1 text-label-sm text-ink-muted transition-colors hover:border-border-strong hover:text-ink disabled:opacity-40">
              Previous
            </button>
            <span className="tnum text-label-sm text-ink">
              Page {current + 1} of {pages}
            </span>
            <button disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="rounded-md border border-border px-2.5 py-1 text-label-sm text-ink-muted transition-colors hover:border-border-strong hover:text-ink disabled:opacity-40">
              Next
            </button>
          </div>
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
    </div>
  );
}

// Small square icon button used in the roster's action column.
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
  const hover = tone === "accent" ? "hover:bg-accent-soft hover:text-accent-hover" : tone === "danger" ? "hover:bg-critical/10 hover:text-critical" : "hover:bg-surface hover:text-ink";
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label} className={`grid h-7 w-7 place-items-center rounded-md text-ink-faint transition-colors ${hover} disabled:opacity-50`}>
      {children}
    </button>
  );
}
