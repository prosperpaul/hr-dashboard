"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Lock, Search, Users, CalendarDays, Check, Zap } from "lucide-react";
import { initialsOf } from "@/lib/sample-data";
import {
  computePayslip,
  formatMoney,
  formatMoneyCompact,
  periodLabel,
  payDateOf,
  DEDUCTION_RATE,
  type SalaryRow,
  type PayRunRow,
} from "@/lib/payroll";
import { setSalary, createPayRun, finalizePayRun, deletePayRun } from "@/lib/payroll-actions";
import StatCard, { type DashStat } from "@/components/dashboard/StatCard";
import { Pill } from "@/components/dashboard/Panel";
import SalaryModal from "./SalaryModal";
import PayRunModal from "./PayRunModal";

const DAY = 86_400_000;
const shortDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// Sum one field across a run's payslips.
const sum = (run: PayRunRow, key: "gross" | "deductions" | "net") =>
  run.payslips.reduce((s, p) => s + p[key], 0);

/*
  Two-step progress indicator: ① Draft → ② Finalized.
  A finished step shows a tick; the current step is emerald.
*/
function Stepper({ status }: { status: string }) {
  const done = status === "Finalized";
  const dot = "grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold";
  return (
    <div className="flex items-center gap-1.5">
      <span className={`${dot} ${done ? "bg-accent-soft text-accent-hover" : "bg-accent text-on-accent"}`}>
        {done ? <Check className="h-3 w-3" /> : 1}
      </span>
      <span className={`h-px w-4 ${done ? "bg-accent" : "bg-border-strong"}`} />
      <span className={`${dot} ${done ? "bg-accent text-on-accent" : "border border-border-strong text-ink-faint"}`}>
        {done ? <Check className="h-3 w-3" /> : 2}
      </span>
      <span className={`ml-1.5 text-label-sm ${done ? "text-accent-hover" : "text-ink-muted"}`}>
        {done ? "Finalized" : "Draft"}
      </span>
    </div>
  );
}

const selectClass =
  "h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-label-md text-ink outline-none transition-colors hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent";

export default function PayrollManager({
  salaries,
  payRuns,
  today,
}: {
  salaries: SalaryRow[];
  payRuns: PayRunRow[];
  today: string; // "YYYY-MM-DD", decided on the server
}) {
  const router = useRouter();
  const [editingSalary, setEditingSalary] = useState<SalaryRow | null>(null);
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(payRuns[0]?.id ?? null);
  const [isPending, startTransition] = useTransition();

  // Ledger filters (all client-side — the list is already loaded).
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");

  const selectedRun = payRuns.find((r) => r.id === selectedRunId) ?? payRuns[0] ?? null;

  // ── Headline numbers ──────────────────────────────────────────────
  const [ty, tm, td] = today.split("-").map(Number);
  const todayDate = new Date(ty, tm - 1, td);
  const currentPeriod = today.slice(0, 7); // "2026-11"
  const payday = new Date(ty, tm, 0); // last day of this month
  const daysToPayday = Math.round((payday.getTime() - todayDate.getTime()) / DAY);
  const currentRun = payRuns.find((r) => r.period === currentPeriod);

  const monthly = salaries.reduce(
    (acc, s) => {
      if (s.salary <= 0) return acc;
      const p = computePayslip(s.salary);
      return { gross: acc.gross + p.gross, net: acc.net + p.net };
    },
    { gross: 0, net: 0 },
  );
  const withSalary = salaries.filter((s) => s.salary > 0).length;
  const missingSalary = salaries.length - withSalary;
  const drafts = payRuns.filter((r) => r.status === "Draft").length;

  // Compare this month's projected net with the last finalized run.
  const lastFinal = payRuns.find((r) => r.status === "Finalized");
  const lastFinalNet = lastFinal ? sum(lastFinal, "net") : 0;
  const netDelta = lastFinalNet > 0 ? Math.round(((monthly.net - lastFinalNet) / lastFinalNet) * 1000) / 10 : null;
  // Runs come newest-first; reverse the last 6 so the sparkline reads left→right.
  const netHistory = payRuns.slice(0, 6).reverse().map((r) => sum(r, "net"));

  const stats: DashStat[] = [
    {
      key: "payroll",
      label: "Monthly payroll (net)",
      value: formatMoneyCompact(monthly.net),
      badge:
        netDelta !== null && netDelta !== 0
          ? { text: `${netDelta > 0 ? "+" : "−"}${Math.abs(netDelta)}%`, trend: netDelta > 0 ? "up" : "down" }
          : undefined,
      spark: netHistory.length >= 2 ? netHistory : undefined,
      footer: { label: "Gross", value: formatMoney(monthly.gross) },
    },
    {
      key: "payday",
      label: "Next pay date",
      value: payday.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      badge: { text: daysToPayday === 0 ? "Today" : `In ${daysToPayday} day${daysToPayday === 1 ? "" : "s"}` },
      footer: {
        label: periodLabel(currentPeriod),
        value: currentRun ? (currentRun.status === "Finalized" ? "Finalized" : "Run in draft") : "No run yet",
        accent: currentRun?.status === "Finalized",
      },
    },
    {
      key: "salaries",
      label: "Salaries set",
      value: `${withSalary}`,
      side: <span className="tnum mb-1 mr-auto ml-1.5 text-headline-sm font-normal text-ink-faint">/ {salaries.length}</span>,
      badge: {
        text: salaries.length ? `${Math.round((withSalary / salaries.length) * 100)}%` : "0%",
        tone: missingSalary === 0 ? "accent" : "neutral",
      },
      bar: [
        { value: withSalary, className: "bg-accent" },
        { value: missingSalary, className: "bg-transparent" },
      ],
      footer: {
        label: "Without a salary",
        value: missingSalary === 0 ? "None" : `${missingSalary} employee${missingSalary === 1 ? "" : "s"}`,
      },
    },
    {
      key: "drafts",
      label: "Draft pay runs",
      value: String(drafts),
      badge: drafts > 0 ? { text: "Requires action", dot: true } : { text: "All finalized", tone: "neutral" },
      footer: { label: "Finalizing locks the payslips", value: `${payRuns.length} runs total` },
    },
  ];

  // ── Ledger filtering ──────────────────────────────────────────────
  const years = useMemo(
    () => [...new Set(payRuns.map((r) => r.period.slice(0, 4)))].sort().reverse(),
    [payRuns],
  );
  const visibleRuns = payRuns.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (yearFilter !== "all" && !r.period.startsWith(yearFilter)) return false;
    const q = query.trim().toLowerCase();
    return !q || periodLabel(r.period).toLowerCase().includes(q) || r.period.includes(q);
  });

  // ── Actions (unchanged logic, all checked again on the server) ────
  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }
  function handleSaveSalary(employeeId: string, salary: number) {
    run(async () => {
      await setSalary(employeeId, salary);
      setSalaryModalOpen(false);
    });
  }
  function handleCreateRun(period: string) {
    run(async () => {
      await createPayRun(period);
      setRunModalOpen(false);
    });
  }
  function handleFinalize(id: string) {
    if (!window.confirm("Finalize this pay run? It will be locked.")) return;
    run(() => finalizePayRun(id));
  }
  function handleDeleteRun(id: string, period: string) {
    if (!window.confirm(`Delete the ${periodLabel(period)} pay run and its payslips?`)) return;
    run(() => deletePayRun(id));
  }

  const sel = selectedRun
    ? { gross: sum(selectedRun, "gross"), deductions: sum(selectedRun, "deductions"), net: sum(selectedRun, "net") }
    : null;
  const selPayday = selectedRun ? payDateOf(selectedRun.period) : null;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-label-sm uppercase tracking-wider text-ink-faint">
            <span>Finance &amp; Operations</span>
            <span>/</span>
            <span className="normal-case tracking-normal text-ink-muted">Payroll</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-headline-lg text-ink md:text-headline-xl">Payroll</h1>
            <Pill tone="accent" dot>
              Cycle: Monthly · {periodLabel(currentPeriod)}
            </Pill>
          </div>
          <p className="max-w-2xl text-body-md text-ink-muted">
            {isPending ? "Working…" : "Manage monthly pay runs, salaries and payslips. All amounts in Naira (₦)."}
          </p>
        </div>

        <button
          onClick={() => setRunModalOpen(true)}
          disabled={isPending}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 self-start rounded-lg bg-accent px-4 text-label-md font-semibold text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] transition-colors hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-60 md:self-auto"
        >
          <Zap className="h-4 w-4" />
          Run payroll
        </button>
      </section>

      {/* ── KPI cards ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.key} stat={s} />
        ))}
      </section>

      {/* ── Ledger (left) + inspector (right) ── */}
      <section className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="space-y-4 xl:col-span-8">
          {/* Filter bar */}
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pay periods…"
                className="h-9 w-full rounded-lg border border-border bg-surface-2 pl-8 pr-3 text-body-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </div>
            <div className="flex gap-2">
              <select aria-label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
                <option value="all">All statuses</option>
                <option value="Draft">Draft</option>
                <option value="Finalized">Finalized</option>
              </select>
              <select aria-label="Year" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className={selectClass}>
                <option value="all">All years</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pay runs table */}
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] leading-[18px]">
                <thead>
                  <tr className="border-b border-border text-label-sm uppercase tracking-[0.05em] text-ink-faint">
                    <th className="px-5 py-3 font-medium">Pay period</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Type</th>
                    <th className="px-4 py-3 font-medium">Team</th>
                    <th className="px-4 py-3 text-right font-medium">Total net</th>
                    <th className="hidden px-4 py-3 font-medium sm:table-cell">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRuns.map((r) => {
                    const active = r.id === selectedRun?.id;
                    const pd = payDateOf(r.period);
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedRunId(r.id)}
                        className={`h-14 cursor-pointer border-b border-border last:border-0 ${active ? "bg-surface-2" : "hover:bg-surface-2"}`}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${r.status === "Draft" ? "bg-accent shadow-[0_0_8px_var(--color-accent)]" : "bg-border-strong"}`} />
                            <div>
                              <p className="font-medium text-ink">{periodLabel(r.period)}</p>
                              <p className="text-body-sm text-ink-faint">
                                {pd ? `${r.status === "Finalized" ? "Paid" : "Pays out"} ${shortDate(pd)}` : r.period}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <span className="rounded-md border border-border bg-bg px-2 py-0.5 text-label-sm text-ink-muted">
                            Regular monthly
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="tnum inline-flex items-center gap-1.5 text-ink-muted">
                            <Users className="h-3.5 w-3.5 text-ink-faint" />
                            {r.payslips.length}
                          </span>
                        </td>
                        <td className="tnum px-4 py-3 text-right font-medium text-ink">{formatMoney(sum(r, "net"))}</td>
                        <td className="hidden px-4 py-3 sm:table-cell">
                          <Stepper status={r.status} />
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation(); // don't also trigger the row click
                              setSelectedRunId(r.id);
                            }}
                            className={[
                              "rounded-md px-2.5 py-1 text-label-sm transition-colors",
                              active
                                ? "bg-accent-soft text-accent-hover"
                                : "border border-border text-ink-muted hover:border-border-strong hover:text-ink",
                            ].join(" ")}
                          >
                            {active ? "Inspecting" : "Inspect"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {visibleRuns.length === 0 && (
                <div className="grid place-items-center py-12 text-center">
                  <p className="text-headline-sm text-ink">{payRuns.length ? "No matching pay runs" : "No pay runs yet"}</p>
                  <p className="mt-1 text-body-md text-ink-muted">
                    {payRuns.length ? "Try a different filter." : "Click “Run payroll” to generate payslips."}
                  </p>
                </div>
              )}
            </div>
            <div className="border-t border-border px-5 py-3 text-body-sm text-ink-faint">
              Showing <span className="tnum text-ink">{visibleRuns.length}</span> of{" "}
              <span className="tnum text-ink">{payRuns.length}</span> pay runs
            </div>
          </div>

          {/* Salaries */}
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-headline-sm text-ink">Compensation</h2>
                <p className="text-body-sm text-ink-faint">Annual gross salaries · payslips use these when a run is created</p>
              </div>
              <span className="tnum hidden text-label-md text-ink-muted sm:block">
                {formatMoney(salaries.reduce((s, r) => s + r.salary, 0))} / yr
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px] leading-[18px]">
                <thead>
                  <tr className="border-b border-border text-label-sm uppercase tracking-[0.05em] text-ink-faint">
                    <th className="px-5 py-3 font-medium">Employee</th>
                    <th className="hidden px-4 py-3 font-medium md:table-cell">Department</th>
                    <th className="px-4 py-3 text-right font-medium">Annual</th>
                    <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">Monthly</th>
                    <th className="px-5 py-3 text-right font-medium">Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {salaries.map((s) => (
                    <tr key={s.employeeId} className="h-12 border-b border-border last:border-0 hover:bg-surface-2">
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent-hover">
                            {initialsOf(s.name)}
                          </div>
                          <span className="font-medium text-ink">{s.name}</span>
                        </div>
                      </td>
                      <td className="hidden px-4 py-2.5 text-ink-muted md:table-cell">{s.department}</td>
                      <td className="tnum px-4 py-2.5 text-right text-ink">
                        {s.salary > 0 ? formatMoney(s.salary) : <span className="text-ink-faint">Not set</span>}
                      </td>
                      <td className="tnum hidden px-4 py-2.5 text-right text-ink-muted sm:table-cell">
                        {s.salary > 0 ? formatMoney(Math.round(s.salary / 12)) : "—"}
                      </td>
                      <td className="px-5 py-2.5">
                        <div className="flex justify-end">
                          <button
                            onClick={() => {
                              setEditingSalary(s);
                              setSalaryModalOpen(true);
                            }}
                            aria-label={`Edit ${s.name}'s salary`}
                            className="grid h-7 w-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface hover:text-accent-hover"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Inspector ── */}
        <aside className="rounded-xl border border-border bg-surface p-5 xl:sticky xl:top-4 xl:col-span-4">
          {selectedRun && sel ? (
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-label-sm uppercase tracking-wider text-ink-faint">Selected run</span>
                  <Pill tone={selectedRun.status === "Finalized" ? "accent" : "neutral"}>{selectedRun.status}</Pill>
                </div>
                <h2 className="mt-2 text-headline-md text-ink">Pay Run Breakdown</h2>
                <p className="mt-1 flex items-center gap-1.5 text-body-sm text-ink-muted">
                  <CalendarDays className="h-3.5 w-3.5 text-ink-faint" />
                  {periodLabel(selectedRun.period)}
                  {selPayday && ` · payout ${shortDate(selPayday)}`}
                </p>
              </div>

              {/* Totals */}
              <div className="space-y-2.5 rounded-lg border border-border bg-bg/60 p-4">
                <div className="flex items-center justify-between text-body-sm">
                  <span className="text-ink-muted">Total gross</span>
                  <span className="tnum text-label-md text-ink">{formatMoney(sel.gross)}</span>
                </div>
                <div className="flex items-center justify-between text-body-sm">
                  <span className="text-ink-muted">Deductions</span>
                  <span className="tnum text-label-md text-critical">−{formatMoney(sel.deductions)}</span>
                </div>
                <div className="flex items-end justify-between gap-3 border-t border-border pt-3">
                  <span className="text-label-md text-ink">Total net pay</span>
                  <span className="tnum text-metric-md font-semibold text-accent-hover">{formatMoney(sel.net)}</span>
                </div>
              </div>

              {/* Breakdown sections */}
              <div className="space-y-4 text-body-sm">
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-label-sm uppercase tracking-wider">
                    <span className="text-ink-faint">1. Gross earnings</span>
                    <span className="tnum text-ink">{formatMoney(sel.gross)}</span>
                  </div>
                  <div className="flex justify-between rounded-lg bg-surface-2 px-3 py-2">
                    <span className="text-ink-muted">Base salary (monthly)</span>
                    <span className="tnum text-ink">{formatMoney(sel.gross)}</span>
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-label-sm uppercase tracking-wider">
                    <span className="text-ink-faint">2. Deductions</span>
                    <span className="tnum text-critical">−{formatMoney(sel.deductions)}</span>
                  </div>
                  <div className="flex justify-between rounded-lg bg-surface-2 px-3 py-2">
                    <span className="text-ink-muted">Tax &amp; statutory (est. {Math.round(DEDUCTION_RATE * 100)}%)</span>
                    <span className="tnum text-ink">−{formatMoney(sel.deductions)}</span>
                  </div>
                </div>
                <div>
                  <div className="mb-1.5 flex items-center justify-between text-label-sm uppercase tracking-wider">
                    <span className="text-ink-faint">3. Payslips</span>
                    <span className="tnum text-ink">{selectedRun.payslips.length}</span>
                  </div>
                  <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg bg-surface-2">
                    {selectedRun.payslips.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <span className="truncate text-ink">{p.employeeName}</span>
                        <span className="tnum shrink-0 text-ink-muted">{formatMoney(p.net)}</span>
                      </li>
                    ))}
                    {selectedRun.payslips.length === 0 && <li className="px-3 py-2 text-ink-faint">No payslips in this run.</li>}
                  </ul>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                {selectedRun.status === "Draft" ? (
                  <button
                    onClick={() => handleFinalize(selectedRun.id)}
                    disabled={isPending}
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent text-label-md font-semibold text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] transition-colors hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-60"
                  >
                    <Lock className="h-4 w-4" />
                    Finalize &amp; lock payslips
                  </button>
                ) : (
                  <p className="flex items-center justify-center gap-2 rounded-lg border border-accent/25 bg-accent-soft py-2.5 text-label-md text-accent-hover">
                    <Check className="h-4 w-4" /> Finalized — employees can see their payslips
                  </p>
                )}
                <button
                  onClick={() => handleDeleteRun(selectedRun.id, selectedRun.period)}
                  disabled={isPending}
                  className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 text-label-md text-ink-muted transition-colors hover:border-critical/40 hover:text-critical disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete pay run
                </button>
              </div>
            </div>
          ) : (
            <div className="grid place-items-center py-12 text-center">
              <p className="text-headline-sm text-ink">No pay run selected</p>
              <p className="mt-1 text-body-md text-ink-muted">Run payroll to generate this month&apos;s payslips.</p>
              <button
                onClick={() => setRunModalOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 py-2 text-label-md text-ink transition-colors hover:border-border-strong"
              >
                <Plus className="h-4 w-4" /> New pay run
              </button>
            </div>
          )}
        </aside>
      </section>

      <SalaryModal
        open={salaryModalOpen}
        employee={editingSalary}
        onClose={() => setSalaryModalOpen(false)}
        onSave={handleSaveSalary}
      />
      <PayRunModal open={runModalOpen} onClose={() => setRunModalOpen(false)} onCreate={handleCreateRun} />
    </div>
  );
}
