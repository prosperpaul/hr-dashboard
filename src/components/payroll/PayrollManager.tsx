"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Lock,
  Search,
  Check,
  Download,
  ArrowRight,
  Clock,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  UserMinus,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { initialsOf } from "@/lib/sample-data";
import { deptTint, deptBadgeClass } from "@/lib/dept-tint";
import {
  computePayslip,
  formatMoney,
  formatMoneyCompact,
  periodLabel,
  payDateOf,
  DEDUCTION_RATE,
  type SalaryRow,
  type PayRunRow,
  type PayslipRow,
} from "@/lib/payroll";
import { setSalary, createPayRun, finalizePayRun, deletePayRun } from "@/lib/payroll-actions";
import SalaryModal from "./SalaryModal";
import PayRunModal from "./PayRunModal";

const DAY = 86_400_000;
const PAGE_SIZE = 8; // employees per page in the payslip table
const shortDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Sum one field across a run's payslips.
const sum = (run: PayRunRow, key: "gross" | "deductions" | "net") => run.payslips.reduce((s, p) => s + p[key], 0);

const caps = "text-[11px] font-bold uppercase tracking-[0.06em]";
const control =
  "h-10 rounded-full border border-border bg-surface px-4 text-label-md text-ink outline-none transition-colors hover:bg-bg focus:border-ink focus:ring-1 focus:ring-ink";

/*
  One step of the pay-cycle progress strip (Draft → Finalized → Payday).
  "done" shows a navy tick, "current" a yellow number, "upcoming" a faded one.
*/
function Step({ n, title, sub, state, badge }: { n: number; title: string; sub: string; state: "done" | "current" | "upcoming"; badge?: string }) {
  const circle =
    state === "done"
      ? "bg-navy text-on-navy"
      : state === "current"
        ? "bg-accent text-on-accent"
        : "border border-border text-ink-faint";
  return (
    <div className={`flex min-w-0 items-center gap-3 ${state === "upcoming" ? "opacity-60" : ""}`}>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-label-sm font-bold ${circle}`}>
        {state === "done" ? <Check className="h-4 w-4" /> : String(n).padStart(2, "0")}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`${caps} text-ink-faint`}>{String(n).padStart(2, "0")}</span>
          <span className="font-display text-headline-sm text-ink">{title}</span>
          {badge && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-accent-ink">{badge}</span>}
        </div>
        <p className="truncate text-body-sm text-ink-muted">{sub}</p>
      </div>
    </div>
  );
}

// Round avatar with initials, tinted by department.
function Avatar({ name, department, size = "h-9 w-9" }: { name: string; department: string; size?: string }) {
  return (
    <span className={`grid ${size} shrink-0 place-items-center rounded-full text-label-sm font-semibold text-ink ${deptTint(department)}`}>
      {initialsOf(name)}
    </span>
  );
}

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
  const currentPeriod = today.slice(0, 7); // "2026-11"
  const [editingSalary, setEditingSalary] = useState<SalaryRow | null>(null);
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [runModalOpen, setRunModalOpen] = useState(false);
  // Start on this month's run if there is one, else the newest run.
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    (payRuns.find((r) => r.period === currentPeriod) ?? payRuns[0])?.id ?? null,
  );
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Staff table filters.
  const [staffQuery, setStaffQuery] = useState("");
  const [staffTab, setStaffTab] = useState<"all" | "inRun" | "missing">("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [page, setPage] = useState(0);

  // Run-history filters (all client-side — the list is already loaded).
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");

  const selectedRun = payRuns.find((r) => r.id === selectedRunId) ?? payRuns[0] ?? null;

  // ── Dates ─────────────────────────────────────────────────────────
  const [ty, tm, td] = today.split("-").map(Number);
  const todayDate = new Date(ty, tm - 1, td);
  const headlinePeriod = selectedRun?.period ?? currentPeriod;
  const payday = payDateOf(headlinePeriod);
  const daysToPayday = payday ? Math.round((payday.getTime() - todayDate.getTime()) / DAY) : null;

  // ── Totals ────────────────────────────────────────────────────────
  // Projected monthly pay from current salaries (used when there's no run yet).
  const projected = salaries.reduce(
    (acc, s) => {
      if (s.salary <= 0) return acc;
      const p = computePayslip(s.salary);
      return { gross: acc.gross + p.gross, deductions: acc.deductions + p.deductions, net: acc.net + p.net };
    },
    { gross: 0, deductions: 0, net: 0 },
  );
  const withSalary = salaries.filter((s) => s.salary > 0).length;
  const missingSalary = salaries.length - withSalary;
  const totals = selectedRun
    ? { gross: sum(selectedRun, "gross"), deductions: sum(selectedRun, "deductions"), net: sum(selectedRun, "net") }
    : projected;
  const slipCount = selectedRun ? selectedRun.payslips.length : withSalary;
  const netPct = totals.gross ? Math.round((totals.net / totals.gross) * 100) : 0;

  // ── Changes since the previous run (real payslip comparison) ─────
  const prevRun = selectedRun ? payRuns.filter((r) => r.period < selectedRun.period).sort((a, b) => b.period.localeCompare(a.period))[0] : undefined;
  const changes = (() => {
    if (!selectedRun || !prevRun) return null;
    const prevById = new Map(prevRun.payslips.map((p) => [p.employeeId, p]));
    const curIds = new Set(selectedRun.payslips.map((p) => p.employeeId));
    const added = selectedRun.payslips.filter((p) => !prevById.has(p.employeeId));
    const removed = prevRun.payslips.filter((p) => !curIds.has(p.employeeId));
    const adjusted = selectedRun.payslips.filter((p) => {
      const before = prevById.get(p.employeeId);
      return before && before.gross !== p.gross;
    });
    return { added, removed, adjusted, prevById };
  })();

  // ── Staff table rows: every employee + their payslip in the selected run ──
  const slipByEmp = new Map<string, PayslipRow>((selectedRun?.payslips ?? []).map((p) => [p.employeeId, p]));
  const deptNames = [...new Set(salaries.map((s) => s.department).filter((d) => d !== "—"))].sort();
  const sq = staffQuery.trim().toLowerCase();
  const staff = salaries
    .filter((s) => (staffTab === "inRun" ? slipByEmp.has(s.employeeId) : staffTab === "missing" ? s.salary <= 0 : true))
    .filter((s) => deptFilter === "all" || s.department === deptFilter)
    .filter((s) => !sq || s.name.toLowerCase().includes(sq) || s.department.toLowerCase().includes(sq));
  const pageCount = Math.max(1, Math.ceil(staff.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = staff.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  // The person shown in the payslip panel: the one clicked, else the first row.
  const focus = salaries.find((s) => s.employeeId === selectedEmpId) ?? pageRows[0] ?? null;
  const focusSlip = focus ? slipByEmp.get(focus.employeeId) : undefined;
  const focusFigures = focusSlip ?? (focus && focus.salary > 0 ? computePayslip(focus.salary) : null);

  // ── Run history filtering ─────────────────────────────────────────
  const years = useMemo(() => [...new Set(payRuns.map((r) => r.period.slice(0, 4)))].sort().reverse(), [payRuns]);
  const visibleRuns = payRuns.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (yearFilter !== "all" && !r.period.startsWith(yearFilter)) return false;
    const q = query.trim().toLowerCase();
    return !q || periodLabel(r.period).toLowerCase().includes(q) || r.period.includes(q);
  });

  // ── Actions (all checked again on the server) ─────────────────────
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
  function editSalary(s: SalaryRow) {
    setEditingSalary(s);
    setSalaryModalOpen(true);
  }

  // Download the selected run's payslips as a spreadsheet-friendly CSV.
  function exportCsv() {
    if (!selectedRun) return;
    const deptOf = new Map(salaries.map((s) => [s.employeeId, s.department]));
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [
      ["Period", "Employee", "Department", "Gross (NGN)", "Deductions (NGN)", "Net (NGN)", "Status"],
      ...selectedRun.payslips.map((p) => [selectedRun.period, p.employeeName, deptOf.get(p.employeeId) ?? "—", p.gross, p.deductions, p.net, selectedRun.status]),
    ];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-${selectedRun.period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Step states for the progress strip.
  const finalized = selectedRun?.status === "Finalized";
  const paidOut = finalized && daysToPayday !== null && daysToPayday <= 0;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="space-y-2">
          <p className={`flex items-center gap-2 ${caps} text-ink-muted`}>
            <span className="h-1.5 w-1.5 rounded-full bg-ink" />
            Operations · {periodLabel(headlinePeriod)} pay cycle
            {isPending && <span className="normal-case tracking-normal font-normal">· Saving…</span>}
          </p>
          <h1 className="text-headline-lg text-ink md:text-headline-xl">{periodLabel(headlinePeriod)} Pay Cycle.</h1>
          <p className="max-w-2xl text-body-md text-ink-muted">
            Monthly pay runs, salaries and payslips across {plural(salaries.length, "staff member")}. All amounts in Naira (₦).
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {payRuns.length > 0 && (
            <select aria-label="Pay run" value={selectedRun?.id ?? ""} onChange={(e) => setSelectedRunId(e.target.value)} className={control}>
              {payRuns.map((r) => (
                <option key={r.id} value={r.id}>
                  {periodLabel(r.period)}
                  {r.period === currentPeriod ? " (Current)" : ""} · {r.status}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={exportCsv}
            disabled={!selectedRun || selectedRun.payslips.length === 0}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-4 text-label-md text-ink transition-colors hover:bg-bg disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export payroll CSV
          </button>
          <button
            onClick={() => setRunModalOpen(true)}
            disabled={isPending}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-navy px-4 text-label-md text-on-navy transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            New pay run
          </button>
        </div>
      </section>

      {/* ── Navy hero: total disbursement + main action ── */}
      <section className="flex flex-col gap-6 rounded-xl bg-navy p-6 text-on-navy md:flex-row md:items-center md:justify-between md:p-8">
        <div className="min-w-0">
          <p className={`flex items-center gap-2 ${caps} text-on-navy-muted`}>
            <span className="h-1.5 w-1.5 rounded-full bg-[#f5c518]" />
            {!selectedRun
              ? `No pay run yet for ${periodLabel(currentPeriod)}`
              : daysToPayday === null
                ? selectedRun.period
                : daysToPayday > 0
                  ? `Payday is in ${plural(daysToPayday, "day")}`
                  : daysToPayday === 0
                    ? "Payday is today"
                    : `Payday was ${plural(-daysToPayday, "day")} ago`}
          </p>
          <p className="tnum mt-2 break-words font-display text-[40px] font-bold leading-[44px] tracking-[-0.02em] md:text-[52px] md:leading-[56px]">
            {formatMoney(totals.net)}
          </p>
          <p className="mt-2 text-body-sm text-on-navy-muted">
            {selectedRun ? "Total net disbursement" : "Projected net pay from current salaries"}
            {payday && ` for ${shortDate(payday)}`} · {plural(slipCount, "payslip")}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
          {!selectedRun ? (
            <button
              onClick={() => setRunModalOpen(true)}
              disabled={isPending}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-label-md text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              Run payroll
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : !finalized ? (
            <button
              onClick={() => handleFinalize(selectedRun.id)}
              disabled={isPending}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-label-md text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              <Lock className="h-4 w-4" />
              Finalize &amp; lock payslips
            </button>
          ) : (
            <span className="inline-flex h-11 items-center gap-2 rounded-full border border-navy-line px-5 text-label-md">
              <Check className="h-4 w-4 text-[#f5c518]" />
              Finalized · visible to employees
            </span>
          )}
          {selectedRun && (
            <div className="flex items-center gap-4 text-body-sm text-on-navy-muted">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Pays out on the last day of the month
              </span>
              <button
                onClick={() => handleDeleteRun(selectedRun.id, selectedRun.period)}
                disabled={isPending}
                className="flex items-center gap-1 underline-offset-2 hover:text-on-navy hover:underline disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete run
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Progress strip ── */}
      {selectedRun && (
        <section className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-surface p-5 sm:grid-cols-3">
          <Step n={1} title="Draft" sub={`Generated · ${plural(selectedRun.payslips.length, "slip")}`} state={finalized ? "done" : "current"} badge={finalized ? undefined : "In progress"} />
          <Step n={2} title="Finalized" sub={finalized ? "Locked · employees can view" : "Awaiting sign-off"} state={finalized ? "done" : "upcoming"} />
          <Step
            n={3}
            title="Payday"
            sub={payday ? `${paidOut ? "Paid" : "Pays out"} ${shortDate(payday)}` : "—"}
            state={paidOut ? "done" : finalized ? "current" : "upcoming"}
          />
        </section>
      )}

      {/* ── Where the money goes + changes since last run ── */}
      <section className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-4">
            <div>
              <h2 className="font-display text-headline-sm text-ink">Where the money goes</h2>
              <p className="text-body-sm text-ink-muted">Gross payroll split for {selectedRun ? "this run" : "current salaries"}</p>
            </div>
            <span className={`tnum ${caps} text-ink-muted`}>Gross: {formatMoney(totals.gross)}</span>
          </div>
          <div className="mt-5 flex h-8 overflow-hidden rounded-md bg-surface-2">
            <div className="h-full bg-navy" style={{ width: `${netPct}%` }} />
            <div className="h-full bg-tint-sky" style={{ width: `${totals.gross ? 100 - netPct : 0}%` }} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-5 md:grid-cols-4">
            {(
              [
                ["bg-navy", `Net pay (${netPct}%)`, formatMoney(totals.net), "Staff take-home"],
                ["bg-tint-sky", `Deductions (${totals.gross ? 100 - netPct : 0}%)`, formatMoney(totals.deductions), `Tax & statutory, est. ${Math.round(DEDUCTION_RATE * 100)}%`],
                ["bg-surface-2", "Payslips", String(slipCount), `of ${plural(salaries.length, "employee")}`],
                ["bg-surface-2", "Average net", slipCount ? formatMoneyCompact(Math.round(totals.net / slipCount)) : "—", "Per payslip"],
              ] as const
            ).map(([dot, label, value, sub]) => (
              <div key={label} className="min-w-0">
                <p className={`flex items-center gap-1.5 ${caps} text-ink-muted`}>
                  <span className={`h-2 w-2 shrink-0 rounded-full border border-border ${dot}`} />
                  <span className="truncate">{label}</span>
                </p>
                <p className="tnum mt-1 truncate font-display text-headline-sm text-ink">{value}</p>
                <p className="truncate text-body-sm text-ink-muted">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-headline-sm text-ink">Changes since last run</h2>
            {prevRun && selectedRun && (
              <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                {periodLabel(prevRun.period).slice(0, 3)} vs {periodLabel(selectedRun.period).slice(0, 3)}
              </span>
            )}
          </div>
          <ul className="mt-3 divide-y divide-border">
            {changes ? (
              <>
                <ChangeItem
                  icon={<UserPlus className="h-4 w-4" />}
                  title={`${plural(changes.added.length, "new payslip")}`}
                  tone="good"
                  tag="Added"
                  names={changes.added.map((p) => p.employeeName)}
                />
                <ChangeItem
                  icon={<TrendingUp className="h-4 w-4" />}
                  title={`${plural(changes.adjusted.length, "salary adjustment")}`}
                  tone="accent"
                  tag="Changed"
                  names={changes.adjusted.map((p) => {
                    const before = changes.prevById.get(p.employeeId)!;
                    return `${p.employeeName} (${p.gross > before.gross ? "+" : "−"}${formatMoney(Math.abs(p.gross - before.gross))}/mo)`;
                  })}
                />
                <ChangeItem
                  icon={<UserMinus className="h-4 w-4" />}
                  title={`${plural(changes.removed.length, "payslip")} dropped`}
                  tone="critical"
                  tag="Removed"
                  names={changes.removed.map((p) => p.employeeName)}
                />
              </>
            ) : (
              <li className="py-3 text-body-sm text-ink-muted">
                {selectedRun ? "This is the earliest pay run — nothing to compare against yet." : "Run payroll to start tracking changes between cycles."}
              </li>
            )}
            {missingSalary > 0 && (
              <li className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-label-md text-ink">
                    <AlertCircle className="h-4 w-4 text-warning" />
                    {plural(missingSalary, "employee")} without a salary
                  </p>
                  <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-bold text-warning">Notice</span>
                </div>
                <p className="mt-1 text-body-sm text-ink-muted">They are left out of new pay runs until a salary is set.</p>
                <button
                  onClick={() => {
                    setStaffTab("missing");
                    setPage(0);
                  }}
                  className="mt-1 text-label-md text-ink underline underline-offset-2 hover:text-ink-muted"
                >
                  Review employees →
                </button>
              </li>
            )}
          </ul>
        </div>
      </section>

      {/* ── Staff payslips table + individual payslip panel ── */}
      <section className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface">
          <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
            <div className="flex shrink-0 rounded-full bg-surface-2 p-1" role="tablist">
              {(
                [
                  ["all", "All", salaries.length],
                  ["inRun", "In this run", selectedRun?.payslips.length ?? 0],
                  ["missing", "No salary", missingSalary],
                ] as const
              ).map(([key, label, n]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={staffTab === key}
                  onClick={() => {
                    setStaffTab(key);
                    setPage(0);
                  }}
                  className={`h-8 rounded-full px-3 text-label-sm transition-colors ${staffTab === key ? "bg-navy text-on-navy" : "text-ink-muted hover:text-ink"}`}
                >
                  {label} <span className="tnum">({n})</span>
                </button>
              ))}
            </div>
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                value={staffQuery}
                onChange={(e) => {
                  setStaffQuery(e.target.value);
                  setPage(0);
                }}
                placeholder="Search staff or department…"
                className="h-10 w-full rounded-full border border-border bg-surface pl-10 pr-4 text-body-sm text-ink outline-none placeholder:text-ink-faint focus:border-ink focus:ring-1 focus:ring-ink"
              />
            </div>
            <select
              aria-label="Department"
              value={deptFilter}
              onChange={(e) => {
                setDeptFilter(e.target.value);
                setPage(0);
              }}
              className={control}
            >
              <option value="all">All departments</option>
              {deptNames.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px] leading-[18px]">
              <thead>
                <tr className={`border-b border-border bg-bg ${caps} text-ink-muted`}>
                  <th className="px-5 py-3">Employee</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3 text-right">Gross pay</th>
                  <th className="px-4 py-3 text-right">Deductions</th>
                  <th className="px-4 py-3 text-right">Net pay</th>
                  <th className="px-4 py-3 text-right">
                    <span className="sr-only">Edit salary</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((s) => {
                  const slip = slipByEmp.get(s.employeeId);
                  // Not in this run → show what they'd earn from their salary, faded.
                  const fig = slip ?? (s.salary > 0 ? computePayslip(s.salary) : null);
                  const isFocus = focus?.employeeId === s.employeeId;
                  return (
                    <tr
                      key={s.employeeId}
                      onClick={() => setSelectedEmpId(s.employeeId)}
                      className={`h-14 cursor-pointer border-b border-border last:border-0 ${isFocus ? "bg-bg shadow-[inset_3px_0_0_var(--color-ink)]" : "hover:bg-bg"}`}
                    >
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={s.name} department={s.department} />
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-ink">{s.name}</p>
                            <p className="text-body-sm text-ink-muted">{s.salary > 0 ? `${formatMoneyCompact(s.salary)} / yr` : "No salary set"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {s.department !== "—" ? <span className={deptBadgeClass(s.department)}>{s.department}</span> : <span className="text-ink-faint">—</span>}
                      </td>
                      {fig ? (
                        <>
                          <td className={`tnum px-4 py-2.5 text-right ${slip ? "text-ink" : "text-ink-faint"}`}>{formatMoney(fig.gross)}</td>
                          <td className={`tnum px-4 py-2.5 text-right ${slip ? "text-ink-muted" : "text-ink-faint"}`}>{formatMoney(fig.deductions)}</td>
                          <td className={`tnum px-4 py-2.5 text-right font-semibold ${slip ? "text-ink" : "text-ink-faint"}`} title={slip ? undefined : "Projected — not in this pay run"}>
                            {formatMoney(fig.net)}
                          </td>
                        </>
                      ) : (
                        <td colSpan={3} className="px-4 py-2.5 text-right text-body-sm text-ink-faint">
                          Not set
                        </td>
                      )}
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // don't also select the row
                            editSalary(s);
                          }}
                          aria-label={`Edit ${s.name}'s salary`}
                          title="Edit salary"
                          className="grid h-8 w-8 place-items-center rounded-full text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {staff.length === 0 && (
              <div className="py-12 text-center">
                <p className="font-display text-headline-sm text-ink">{salaries.length ? "No matching staff" : "No employees yet"}</p>
                <p className="mt-1 text-body-md text-ink-muted">{salaries.length ? "Try a different filter." : "Add employees to start running payroll."}</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
            <p className="text-body-sm text-ink-muted">
              {staff.length
                ? `Showing ${safePage * PAGE_SIZE + 1}–${Math.min(staff.length, (safePage + 1) * PAGE_SIZE)} of ${plural(staff.length, "team member")}`
                : "Showing 0 team members"}
              {selectedRun && " · faded figures are projected (not in this run)"}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(safePage - 1)}
                disabled={safePage === 0}
                aria-label="Previous page"
                className="grid h-8 w-8 place-items-center rounded-full border border-border text-ink transition-colors hover:bg-bg disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="tnum text-label-sm text-ink">
                Page {safePage + 1} of {pageCount}
              </span>
              <button
                onClick={() => setPage(safePage + 1)}
                disabled={safePage >= pageCount - 1}
                aria-label="Next page"
                className="grid h-8 w-8 place-items-center rounded-full border border-border text-ink transition-colors hover:bg-bg disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Individual payslip panel */}
        <aside className="rounded-xl border border-border bg-surface p-5 xl:sticky xl:top-4">
          {focus ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 border-b border-border pb-4">
                <Avatar name={focus.name} department={focus.department} size="h-11 w-11" />
                <div className="min-w-0">
                  <p className="truncate font-display text-headline-sm text-ink">{focus.name}</p>
                  <p className="text-body-sm text-ink-muted">{focus.department}</p>
                  <p className="text-body-sm text-ink-faint">{focusSlip ? `In ${periodLabel(selectedRun!.period)} run` : selectedRun ? "Not in this pay run" : "No pay run yet"}</p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-bg p-4">
                <p className={`${caps} text-ink-muted`}>{focusSlip ? "Net take-home pay" : "Projected take-home pay"}</p>
                <p className="tnum mt-1 font-display text-metric-md text-ink">{focusFigures ? formatMoney(focusFigures.net) : "—"}</p>
                <p className="mt-1 text-body-sm text-ink-muted">{focusFigures ? "Per month, after estimated deductions" : "Set a salary to calculate pay"}</p>
              </div>

              {focusFigures && (
                <>
                  <div>
                    <div className={`mb-2 flex items-center justify-between ${caps} text-ink-muted`}>
                      <span>Gross earnings</span>
                      <span className="tnum text-ink">{formatMoney(focusFigures.gross)}</span>
                    </div>
                    <dl className="space-y-2 rounded-lg border border-border p-3 text-body-sm">
                      <div className="flex justify-between">
                        <dt className="text-ink-muted">Base salary (monthly)</dt>
                        <dd className="tnum text-ink">{formatMoney(focusFigures.gross)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-ink-muted">Annual salary (current)</dt>
                        <dd className="tnum text-ink">{formatMoney(focus.salary)}</dd>
                      </div>
                    </dl>
                  </div>
                  <div>
                    <div className={`mb-2 flex items-center justify-between ${caps} text-ink-muted`}>
                      <span>Deductions</span>
                      <span className="tnum text-critical">−{formatMoney(focusFigures.deductions)}</span>
                    </div>
                    <dl className="rounded-lg border border-border p-3 text-body-sm">
                      <div className="flex justify-between gap-2">
                        <dt className="text-ink-muted">Tax &amp; statutory (est. {Math.round(DEDUCTION_RATE * 100)}%)</dt>
                        <dd className="tnum text-ink">−{formatMoney(focusFigures.deductions)}</dd>
                      </div>
                    </dl>
                  </div>
                </>
              )}

              <button
                onClick={() => editSalary(focus)}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-full border border-ink text-label-md text-ink transition-colors hover:bg-bg"
              >
                <Pencil className="h-4 w-4" />
                Edit salary
              </button>
            </div>
          ) : (
            <p className="py-10 text-center text-body-md text-ink-muted">Select an employee to see their payslip.</p>
          )}
        </aside>
      </section>

      {/* ── Pay run history ── */}
      <section className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-display text-headline-sm text-ink">Pay run history</h2>
            <p className="text-body-sm text-ink-muted">Every cycle so far — click one to inspect it above.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pay periods…"
                className="h-10 w-full rounded-full border border-border bg-surface pl-10 pr-4 text-body-sm text-ink outline-none placeholder:text-ink-faint focus:border-ink focus:ring-1 focus:ring-ink sm:w-56"
              />
            </div>
            <div className="flex gap-2">
              <select aria-label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={control}>
                <option value="all">All statuses</option>
                <option value="Draft">Draft</option>
                <option value="Finalized">Finalized</option>
              </select>
              <select aria-label="Year" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className={control}>
                <option value="all">All years</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px] leading-[18px]">
            <thead>
              <tr className={`border-b border-border bg-bg ${caps} text-ink-muted`}>
                <th className="px-5 py-3">Pay period</th>
                <th className="px-4 py-3 text-right">Payslips</th>
                <th className="px-4 py-3 text-right">Total net</th>
                <th className="hidden px-4 py-3 sm:table-cell">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleRuns.map((r) => {
                const active = r.id === selectedRun?.id;
                const pd = payDateOf(r.period);
                return (
                  <tr key={r.id} onClick={() => setSelectedRunId(r.id)} className={`h-14 cursor-pointer border-b border-border last:border-0 ${active ? "bg-bg" : "hover:bg-bg"}`}>
                    <td className="px-5 py-2.5">
                      <p className="font-semibold text-ink">
                        {periodLabel(r.period)}
                        {r.period === currentPeriod && <span className="ml-2 text-body-sm font-normal text-ink-muted">Current</span>}
                      </p>
                      <p className="text-body-sm text-ink-muted">{pd ? `${r.status === "Finalized" ? "Paid" : "Pays out"} ${shortDate(pd)}` : r.period}</p>
                    </td>
                    <td className="tnum px-4 py-2.5 text-right text-ink-muted">{r.payslips.length}</td>
                    <td className="tnum px-4 py-2.5 text-right font-semibold text-ink">{formatMoney(sum(r, "net"))}</td>
                    <td className="hidden px-4 py-2.5 sm:table-cell">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-label-sm ${r.status === "Finalized" ? "bg-good/10 text-good" : "bg-accent-soft text-accent-ink"}`}
                      >
                        {r.status === "Finalized" ? <Check className="h-3 w-3" /> : <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
                        {r.status}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <span className={`inline-flex h-8 items-center rounded-full px-3 text-label-sm ${active ? "bg-navy text-on-navy" : "border border-border text-ink-muted"}`}>
                        {active ? "Inspecting" : "Inspect"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visibleRuns.length === 0 && (
            <div className="py-12 text-center">
              <p className="font-display text-headline-sm text-ink">{payRuns.length ? "No matching pay runs" : "No pay runs yet"}</p>
              <p className="mt-1 text-body-md text-ink-muted">{payRuns.length ? "Try a different filter." : "Click “New pay run” to generate payslips."}</p>
            </div>
          )}
        </div>
      </section>

      <SalaryModal open={salaryModalOpen} employee={editingSalary} onClose={() => setSalaryModalOpen(false)} onSave={handleSaveSalary} />
      <PayRunModal open={runModalOpen} defaultPeriod={currentPeriod} onClose={() => setRunModalOpen(false)} onCreate={handleCreateRun} />
    </div>
  );
}

/*
  One entry in "Changes since last run": a count, a coloured tag, and up to
  three names (with "+N more").
*/
function ChangeItem({
  icon,
  title,
  tag,
  tone,
  names,
}: {
  icon: React.ReactNode;
  title: string;
  tag: string;
  tone: "good" | "accent" | "critical";
  names: string[];
}) {
  const tagClass = tone === "good" ? "bg-good/10 text-good" : tone === "critical" ? "bg-critical/10 text-critical" : "bg-accent-soft text-accent-ink";
  return (
    <li className={`py-3 ${names.length === 0 ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-label-md text-ink">
          <span className="text-ink-muted">{icon}</span>
          {title}
        </p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${tagClass}`}>{tag}</span>
      </div>
      {names.length > 0 && (
        <p className="mt-1 text-body-sm text-ink-muted">
          {names.slice(0, 3).join(", ")}
          {names.length > 3 && ` +${names.length - 3} more`}
        </p>
      )}
    </li>
  );
}
