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
  Users,
  Receipt,
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
import PageHeader from "@/components/ui/PageHeader";
import ResponsiveList from "@/components/ui/ResponsiveList";
import ListRow from "@/components/ui/ListRow";
import StatusText from "@/components/ui/StatusText";
import EmptyState from "@/components/ui/EmptyState";
import FilterBar from "@/components/ui/FilterBar";
import BottomSheet from "@/components/ui/BottomSheet";
import { ChipTabs } from "@/components/ui/Chips";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form";
import ConfirmSheet, { type Confirmation } from "@/components/employees/ConfirmSheet";
import SalaryModal from "./SalaryModal";
import PayRunModal from "./PayRunModal";

const DAY = 86_400_000;
const PAGE_SIZE = 8; // employees per page in the payslip table
const shortDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Sum one field across a run's payslips.
const sum = (run: PayRunRow, key: "gross" | "deductions" | "net") => run.payslips.reduce((s, p) => s + p[key], 0);

const caps = "text-eyebrow uppercase";
// Pill-shaped select: 48px on phones/tablets, 40px from lg (mouse) up.
const control = `${inputClass.replace("rounded-lg", "rounded-full").replace("lg:min-h-11", "lg:min-h-10")} cursor-pointer px-4`;
// Search field with room for the magnifier icon on the left.
const searchInput = inputClass.replace("px-3.5", "pl-10 pr-4").replace("rounded-lg", "rounded-full").replace("lg:min-h-11", "lg:min-h-10");

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
        {state === "done" ? <Check className="h-4 w-4" aria-hidden /> : String(n).padStart(2, "0")}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`${caps} text-ink-faint`}>{String(n).padStart(2, "0")}</span>
          <span className="font-display text-headline-sm text-ink">{title}</span>
          {badge && <span className={`rounded-full bg-accent-soft px-2 py-0.5 ${caps} text-accent-ink`}>{badge}</span>}
        </div>
        <p className="truncate text-body-sm text-ink-muted">{sub}</p>
      </div>
    </div>
  );
}

// Round avatar with initials, tinted by department.
function Avatar({ name, department, size = "h-9 w-9" }: { name: string; department: string; size?: string }) {
  return (
    <span aria-hidden className={`grid ${size} shrink-0 place-items-center rounded-full text-label-sm font-semibold text-ink ${deptTint(department)}`}>
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
  // Phones: tapping a staff row opens their payslip in a bottom sheet.
  const [sheetEmpId, setSheetEmpId] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
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

  // Phones: the same comparison as one list of people, each with how much
  // their NET pay moved (new = their whole net, dropped = minus their old net).
  // Biggest moves first, top 4 — like the mobile mockup's "Changes" card.
  const phoneChanges = changes
    ? [
        ...changes.added.map((p) => ({ id: p.employeeId, name: p.employeeName, note: "New in this run", delta: p.net })),
        ...changes.removed.map((p) => ({ id: p.employeeId, name: p.employeeName, note: "Not in this run", delta: -p.net })),
        ...selectedRun!.payslips.flatMap((p) => {
          const before = changes.prevById.get(p.employeeId);
          return before && before.net !== p.net
            ? [{ id: p.employeeId, name: p.employeeName, note: `Net was ${formatMoney(before.net)}`, delta: p.net - before.net }]
            : [];
        }),
      ].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    : [];

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
  const sheetEmp = salaries.find((s) => s.employeeId === sheetEmpId) ?? null;

  // A row's figures: their payslip in this run, else what they'd earn (projected).
  const figuresOf = (s: SalaryRow) => slipByEmp.get(s.employeeId) ?? (s.salary > 0 ? computePayslip(s.salary) : null);

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
  // "Are you sure?" now happens in a bottom sheet instead of window.confirm.
  function handleFinalize(id: string) {
    setConfirmation({
      title: "Finalize this pay run?",
      message: "It will be locked, and employees will be able to see their payslips.",
      confirmLabel: "Finalize & lock",
      onConfirm: () => run(() => finalizePayRun(id)),
    });
  }
  function handleDeleteRun(id: string, period: string) {
    setConfirmation({
      title: `Delete the ${periodLabel(period)} pay run?`,
      message: "The run and all of its payslips will be removed. This can't be undone.",
      confirmLabel: "Delete run",
      danger: true,
      onConfirm: () => run(() => deletePayRun(id)),
    });
  }
  function editSalary(s: SalaryRow) {
    setEditingSalary(s);
    setSalaryModalOpen(true);
  }
  const closeConfirm = () => setConfirmation(null);
  const closeSheet = () => setSheetEmpId(null);
  const closeSalary = () => setSalaryModalOpen(false);
  const closeRun = () => setRunModalOpen(false);

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

  // How a staff member stands in the selected run, as words + icon (not colour alone).
  const staffStatus = (s: SalaryRow) =>
    slipByEmp.has(s.employeeId) ? (
      <StatusText tone="good" variant="pill">
        In run
      </StatusText>
    ) : s.salary > 0 ? (
      <StatusText tone="neutral" variant="pill">
        Projected
      </StatusText>
    ) : (
      <StatusText tone="warning" variant="pill">
        No salary
      </StatusText>
    );

  // Phones/tablets: the page's ONE main action, shown as a full-width yellow
  // pill at the bottom (mockup's "Run payroll"). It follows the run's state:
  // no run yet → create one; draft → finalize it; finalized → start the next.
  const primary = !selectedRun
    ? { label: "Run payroll", icon: <ArrowRight className="h-5 w-5" aria-hidden />, onClick: () => setRunModalOpen(true) }
    : !finalized
      ? { label: "Finalize & lock payslips", icon: <Lock className="h-5 w-5" aria-hidden />, onClick: () => handleFinalize(selectedRun.id) }
      : { label: "New pay run", icon: <Plus className="h-5 w-5" aria-hidden />, onClick: () => setRunModalOpen(true) };

  const staffTabs = [
    ["all", "All", salaries.length],
    ["inRun", "In this run", selectedRun?.payslips.length ?? 0],
    ["missing", "No salary", missingSalary],
  ] as const;

  const staffFilterCount = deptFilter !== "all" ? 1 : 0;
  const runFilterCount = (statusFilter !== "all" ? 1 : 0) + (yearFilter !== "all" ? 1 : 0);

  return (
    <div className="min-w-0 space-y-6">
      {/* ── Header ── (stacks on phones: select full width, then the two buttons) */}
      <PageHeader
        className="mb-0! md:mb-0!"
        eyebrow={
          <>
            Operations · {periodLabel(headlinePeriod)} pay cycle
            {isPending && <span className="font-normal normal-case tracking-normal text-ink-muted"> · Saving…</span>}
          </>
        }
        title={`${periodLabel(headlinePeriod)} Pay Cycle.`}
        description={`Monthly pay runs, salaries and payslips across ${plural(salaries.length, "staff member")}. All amounts in Naira (₦).`}
        actions={
          <>
            {payRuns.length > 0 && (
              <select
                aria-label="Pay run"
                value={selectedRun?.id ?? ""}
                onChange={(e) => setSelectedRunId(e.target.value)}
                className={`${control} w-full sm:w-auto`}
              >
                {payRuns.map((r) => (
                  <option key={r.id} value={r.id}>
                    {periodLabel(r.period)}
                    {r.period === currentPeriod ? " (Current)" : ""} · {r.status}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={exportCsv}
              disabled={!selectedRun || selectedRun.payslips.length === 0}
              className={`${buttonClass("secondary")} flex-1 sm:flex-none`}
            >
              <Download className="h-4 w-4" aria-hidden />
              <span className="sm:hidden">Export CSV</span>
              <span className="hidden sm:inline">Export payroll CSV</span>
            </button>
            {/* Phones/tablets: when the bottom yellow pill already says "Run payroll"
                / "New pay run", this would be a duplicate, so it only shows there
                while a draft is open (the pill is then "Finalize"). */}
            <button
              type="button"
              onClick={() => setRunModalOpen(true)}
              disabled={isPending}
              className={`${buttonClass("navy")} ${selectedRun && !finalized ? "flex-1 sm:flex-none" : "max-lg:hidden"}`}
            >
              <Plus className="h-4 w-4" aria-hidden />
              New pay run
            </button>
          </>
        }
      />

      {/* ═══ Phones & tablets (< lg): the mobile mockup's stacked cards ═══ */}
      {/* Navy hero: cycle pill, payday countdown, total commitment (gross) and
          the run's real states as a stepper: Draft → Finalized → Payday. */}
      <section aria-label="Pay cycle summary" className="flex min-w-0 flex-col gap-5 rounded-xl bg-navy p-5 text-on-navy lg:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex min-w-0 items-center gap-2 rounded-full bg-on-navy/10 px-3 py-1 text-label-sm">
            <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />
            <span className="truncate">
              {periodLabel(headlinePeriod)} · {plural(slipCount, "employee")}
            </span>
          </span>
          {daysToPayday !== null && (
            <span className="text-label-sm font-semibold text-accent">
              {daysToPayday > 0 ? `Payday in ${plural(daysToPayday, "day")}` : daysToPayday === 0 ? "Payday is today" : `Paid ${plural(-daysToPayday, "day")} ago`}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-label-md text-on-navy-muted">{selectedRun ? "Total payroll commitment" : "Projected payroll commitment"}</p>
          {/* 32px so a big Naira figure still fits a 360px screen. */}
          <p className="tnum mt-1 font-display text-[32px] font-bold leading-[38px] tracking-[-0.02em] [overflow-wrap:anywhere] sm:text-[40px] sm:leading-[44px]">
            {formatMoney(totals.gross)}
          </p>
          {!selectedRun && <p className="mt-1 text-body-sm text-on-navy-muted">No pay run yet for {periodLabel(currentPeriod)} — figures come from current salaries.</p>}
        </div>
        {selectedRun && (
          <>
            <ol aria-label="Pay run progress" className="grid grid-cols-3 gap-2">
              {(
                [
                  ["Draft", finalized ? "done" : "current"],
                  ["Finalized", finalized ? "done" : "upcoming"],
                  ["Payday", paidOut ? "done" : finalized ? "current" : "upcoming"],
                ] as const
              ).map(([label, state], i) => (
                <li key={label} aria-current={state === "current" ? "step" : undefined} className="flex flex-col items-center gap-1.5">
                  <span
                    className={`grid size-7 place-items-center rounded-full text-label-md font-bold ${
                      state === "done" ? "bg-on-navy text-navy" : state === "current" ? "bg-accent text-on-accent" : "bg-on-navy/15 text-on-navy-muted"
                    }`}
                  >
                    {state === "done" ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
                  </span>
                  <span className={`text-label-sm ${state === "current" ? "font-semibold text-accent" : state === "done" ? "text-on-navy" : "text-on-navy-muted"}`}>
                    {label}
                    <span className="sr-only">{state === "done" ? " (done)" : state === "current" ? " (current)" : " (upcoming)"}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="flex items-center justify-between gap-3 border-t border-navy-line pt-1 text-body-sm text-on-navy-muted">
              <span className="min-w-0 truncate">{payday ? `Pays out ${shortDate(payday)}` : selectedRun.period}</span>
              <button
                type="button"
                onClick={() => handleDeleteRun(selectedRun.id, selectedRun.period)}
                disabled={isPending}
                className="-mr-2 inline-flex min-h-tap shrink-0 items-center gap-1 rounded-full px-2 hover:text-on-navy disabled:opacity-60"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Delete run
              </button>
            </div>
          </>
        )}
      </section>

      {/* Where the money goes: the data really has two parts — net pay and
          deductions (one flat estimated rate) — so the bar has two segments. */}
      <section className="min-w-0 rounded-xl border border-border bg-surface p-4 lg:hidden">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-headline-sm text-ink">Where the money goes</h2>
          <span className="tnum shrink-0 text-label-sm text-ink-muted">Gross {formatMoneyCompact(totals.gross)}</span>
        </div>
        <div className="mt-4 flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-sunken" aria-hidden>
          <div className="h-full bg-navy" style={{ width: `${netPct}%` }} />
          <div className="h-full bg-accent" style={{ width: `${totals.gross ? 100 - netPct : 0}%` }} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4">
          {(
            [
              ["bg-navy", `Net pay (${netPct}%)`, totals.net],
              ["bg-accent", `Deductions (${totals.gross ? 100 - netPct : 0}%)`, totals.deductions],
            ] as const
          ).map(([dot, label, value]) => (
            <div key={label} className="flex min-w-0 items-start gap-2">
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} aria-hidden />
              <div className="min-w-0">
                <dt className="truncate text-body-sm text-ink-muted">{label}</dt>
                <dd className="tnum truncate text-label-md font-semibold text-ink">{formatMoney(value)}</dd>
              </div>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-body-sm text-ink-faint">Deductions are tax &amp; statutory, estimated at {Math.round(DEDUCTION_RATE * 100)}% of gross.</p>
      </section>

      {/* Changes since last run: each person's net pay compared with the
          previous run's payslip. Hidden when there's nothing to compare. */}
      {(prevRun || missingSalary > 0) && (
        <section className="min-w-0 rounded-xl border border-border bg-surface p-4 lg:hidden">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-headline-sm text-ink">Changes since last run</h2>
            {prevRun && selectedRun && (
              <span className="shrink-0 text-label-sm text-ink-muted">
                {periodLabel(prevRun.period).slice(0, 3)} vs {periodLabel(selectedRun.period).slice(0, 3)}
              </span>
            )}
          </div>
          <ul className="mt-2 divide-y divide-border">
            {prevRun && phoneChanges.length === 0 && (
              <li className="py-3 text-body-sm text-ink-muted">No pay changes since {periodLabel(prevRun.period)}.</li>
            )}
            {phoneChanges.slice(0, 4).map((c) => (
              <li key={`${c.id}-${c.note}`} className="flex min-h-tap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-label-md font-semibold text-ink">{c.name}</p>
                  <p className="truncate text-body-sm text-ink-muted">{c.note}</p>
                </div>
                <span className={`tnum shrink-0 text-label-md font-semibold ${c.delta >= 0 ? "text-good" : "text-critical"}`}>
                  {c.delta >= 0 ? "+" : "−"}
                  {formatMoney(Math.abs(c.delta))}
                </span>
              </li>
            ))}
            {phoneChanges.length > 4 && <li className="py-3 text-body-sm text-ink-muted">+{plural(phoneChanges.length - 4, "more change")}</li>}
            {missingSalary > 0 && (
              <li className="flex min-h-tap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-label-md font-semibold text-ink">
                    <AlertCircle className="h-4 w-4 shrink-0 text-warning" aria-hidden />
                    {plural(missingSalary, "employee")} without a salary
                  </p>
                  <p className="text-body-sm text-ink-muted">Left out of new pay runs until a salary is set.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStaffTab("missing");
                    setPage(0);
                    document.getElementById("payslips-phone")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="inline-flex min-h-tap shrink-0 items-center gap-1 text-label-md font-semibold text-ink"
                >
                  Review
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              </li>
            )}
          </ul>
        </section>
      )}

      {/* ═══ Desktop (lg+) ═══ */}
      {/* ── Navy hero: total disbursement + main action ── */}
      <section className="flex min-w-0 flex-col gap-6 rounded-xl bg-navy p-5 text-on-navy max-lg:hidden md:flex-row md:items-center md:justify-between md:p-8">
        <div className="min-w-0">
          <p className={`flex items-center gap-2 ${caps} text-on-navy-muted`}>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
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
          {/* 32px on phones so a big Naira figure fits a 360px screen; grows from md. */}
          <p className="tnum mt-2 font-display text-[32px] font-bold leading-[38px] tracking-[-0.02em] [overflow-wrap:anywhere] sm:text-[40px] sm:leading-[44px] md:text-[52px] md:leading-[56px]">
            {formatMoney(totals.net)}
          </p>
          <p className="mt-2 text-body-sm text-on-navy-muted">
            {selectedRun ? "Total net disbursement" : "Projected net pay from current salaries"}
            {payday && ` for ${shortDate(payday)}`} · {plural(slipCount, "payslip")}
          </p>
          {/* Phones: gross and deductions right in the hero (mobile mockup's
              navy summary). Desktop shows them in "Where the money goes". */}
          <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-navy-line pt-4 md:hidden">
            <div className="min-w-0">
              <dt className={`${caps} text-on-navy-muted`}>Gross</dt>
              <dd className="tnum truncate font-display text-headline-sm">{formatMoneyCompact(totals.gross)}</dd>
            </div>
            <div className="min-w-0">
              <dt className={`${caps} text-on-navy-muted`}>Deductions</dt>
              <dd className="tnum truncate font-display text-headline-sm">−{formatMoneyCompact(totals.deductions)}</dd>
            </div>
          </dl>
        </div>
        <div className="flex min-w-0 shrink-0 flex-col items-stretch gap-3 md:items-end">
          {!selectedRun ? (
            <button type="button" onClick={() => setRunModalOpen(true)} disabled={isPending} className={`${buttonClass("primary")} w-full md:w-auto`}>
              Run payroll
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          ) : !finalized ? (
            <button type="button" onClick={() => handleFinalize(selectedRun.id)} disabled={isPending} className={`${buttonClass("primary")} w-full md:w-auto`}>
              <Lock className="h-4 w-4" aria-hidden />
              Finalize &amp; lock payslips
            </button>
          ) : (
            <span className="inline-flex min-h-tap items-center justify-center gap-2 rounded-full border border-navy-line px-5 text-label-md lg:min-h-11">
              <Check className="h-4 w-4 text-accent" aria-hidden />
              Finalized · visible to employees
            </span>
          )}
          {selectedRun && (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-body-sm text-on-navy-muted md:justify-end">
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Pays out on the last day of the month
              </span>
              <button
                type="button"
                onClick={() => handleDeleteRun(selectedRun.id, selectedRun.period)}
                disabled={isPending}
                className="-mx-2 inline-flex min-h-tap items-center gap-1 rounded-full px-2 underline-offset-2 hover:text-on-navy hover:underline disabled:opacity-60 lg:min-h-9"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Delete run
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Progress strip ── */}
      {selectedRun && (
        <section aria-label="Pay cycle progress" className="grid grid-cols-1 gap-4 rounded-xl border border-border bg-surface p-4 max-lg:hidden sm:grid-cols-3 md:p-5">
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
      <section className="grid grid-cols-1 items-start gap-6 max-lg:hidden xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 rounded-xl border border-border bg-surface p-4 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-4">
            <div className="min-w-0">
              <h2 className="font-display text-headline-sm text-ink">Where the money goes</h2>
              <p className="text-body-sm text-ink-muted">Gross payroll split for {selectedRun ? "this run" : "current salaries"}</p>
            </div>
            <span className={`tnum ${caps} text-ink-muted`}>Gross: {formatMoney(totals.gross)}</span>
          </div>
          <div className="mt-5 flex h-8 overflow-hidden rounded-md bg-surface-2" aria-hidden>
            <div className="h-full bg-navy" style={{ width: `${netPct}%` }} />
            <div className="h-full bg-tint-sky" style={{ width: `${totals.gross ? 100 - netPct : 0}%` }} />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
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
                  <span className={`h-2 w-2 shrink-0 rounded-full border border-border ${dot}`} aria-hidden />
                  <span className="truncate">{label}</span>
                </p>
                <p className="tnum mt-1 truncate font-display text-headline-sm text-ink">{value}</p>
                <p className="truncate text-body-sm text-ink-muted">{sub}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="min-w-0 rounded-xl border border-border bg-surface p-4 md:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-headline-sm text-ink">Changes since last run</h2>
            {prevRun && selectedRun && (
              <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-label-sm text-ink-muted">
                {periodLabel(prevRun.period).slice(0, 3)} vs {periodLabel(selectedRun.period).slice(0, 3)}
              </span>
            )}
          </div>
          <ul className="mt-3 divide-y divide-border">
            {changes ? (
              <>
                <ChangeItem
                  icon={<UserPlus className="h-4 w-4" aria-hidden />}
                  title={`${plural(changes.added.length, "new payslip")}`}
                  tone="good"
                  tag="Added"
                  names={changes.added.map((p) => p.employeeName)}
                />
                <ChangeItem
                  icon={<TrendingUp className="h-4 w-4" aria-hidden />}
                  title={`${plural(changes.adjusted.length, "salary adjustment")}`}
                  tone="accent"
                  tag="Changed"
                  names={changes.adjusted.map((p) => {
                    const before = changes.prevById.get(p.employeeId)!;
                    return `${p.employeeName} (${p.gross > before.gross ? "+" : "−"}${formatMoney(Math.abs(p.gross - before.gross))}/mo)`;
                  })}
                />
                <ChangeItem
                  icon={<UserMinus className="h-4 w-4" aria-hidden />}
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
                  <p className="flex min-w-0 items-center gap-2 text-label-md text-ink">
                    <AlertCircle className="h-4 w-4 shrink-0 text-warning" aria-hidden />
                    {plural(missingSalary, "employee")} without a salary
                  </p>
                  <span className="shrink-0 rounded-full bg-warning/10 px-2 py-0.5 text-label-sm font-bold text-warning">Notice</span>
                </div>
                <p className="mt-1 text-body-sm text-ink-muted">They are left out of new pay runs until a salary is set.</p>
                <button
                  type="button"
                  onClick={() => {
                    setStaffTab("missing");
                    setPage(0);
                  }}
                  className="inline-flex min-h-tap items-center text-label-md text-ink underline underline-offset-2 hover:text-ink-muted lg:mt-1 lg:min-h-0"
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
        {/* Phones/tablets: "Payslips (N)" heading above the list, as in the mockup.
            (Hidden from lg, so it never takes a desktop grid cell.) */}
        <div id="payslips-phone" className="-mb-3 flex items-baseline justify-between gap-2 lg:hidden">
          <h2 className="font-display text-headline-sm text-ink">
            Payslips <span className="tnum">({selectedRun ? selectedRun.payslips.length : 0})</span>
          </h2>
          {missingSalary > 0 && <span className="text-label-sm text-ink-muted">{missingSalary} without salary</span>}
        </div>
        <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface">
          <div className="flex min-w-0 flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center">
            {/* Phones/tablets: navy-selected chips in a swipe row (ChipTabs).
                From lg up: the original compact segmented pill. */}
            <ChipTabs
              className="lg:hidden"
              label="Staff in this run"
              value={staffTab}
              onChange={(k) => {
                setStaffTab(k as typeof staffTab);
                setPage(0);
              }}
              options={staffTabs.map(([key, label, count]) => ({ key, label, count }))}
            />
            <div role="group" aria-label="Staff in this run" className="hidden shrink-0 rounded-full bg-surface-2 p-1 lg:flex">
              {staffTabs.map(([key, label, n]) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={staffTab === key}
                  onClick={() => {
                    setStaffTab(key);
                    setPage(0);
                  }}
                  className={`h-8 whitespace-nowrap rounded-full px-3 text-label-sm transition-colors ${staffTab === key ? "bg-navy text-on-navy" : "text-ink-muted hover:text-ink"}`}
                >
                  {label} <span className="tnum">({n})</span>
                </button>
              ))}
            </div>
            <FilterBar
              className="flex-1"
              activeCount={staffFilterCount}
              onReset={() => {
                setDeptFilter("all");
                setPage(0);
              }}
              search={
                <div className="relative w-full">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
                  <input
                    type="search"
                    autoComplete="off"
                    enterKeyHint="search"
                    aria-label="Search staff"
                    value={staffQuery}
                    onChange={(e) => {
                      setStaffQuery(e.target.value);
                      setPage(0);
                    }}
                    placeholder="Search staff or department…"
                    className={searchInput}
                  />
                </div>
              }
            >
              <select
                aria-label="Department"
                value={deptFilter}
                onChange={(e) => {
                  setDeptFilter(e.target.value);
                  setPage(0);
                }}
                className={`${control} md:w-auto`}
              >
                <option value="all">All departments</option>
                {deptNames.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </FilterBar>
          </div>

          {/* Table from md up; on phones each person is a row that opens their payslip in a sheet. */}
          <ResponsiveList
            inset
            caption="Staff payslips"
            rows={pageRows}
            getKey={(s) => s.employeeId}
            listClassName="px-4"
            // "relative" lets the name button stretch over the whole row, so
            // clicking anywhere on a desktop row still selects that person.
            rowClassName={(s) =>
              `relative cursor-pointer ${focus?.employeeId === s.employeeId ? "bg-bg shadow-[inset_3px_0_0_var(--color-ink)]" : ""}`
            }
            empty={
              <EmptyState
                icon={Users}
                title={salaries.length ? "No matching staff" : "No employees yet"}
                description={salaries.length ? "Try a different filter." : "Add employees to start running payroll."}
              />
            }
            columns={[
              {
                key: "employee",
                header: "Employee",
                cell: (s) => (
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={s.name} department={s.department} />
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => setSelectedEmpId(s.employeeId)}
                        aria-pressed={focus?.employeeId === s.employeeId}
                        className="block max-w-full truncate text-left font-semibold text-ink before:absolute before:inset-0 before:content-['']"
                      >
                        {s.name}
                      </button>
                      <p className="text-body-sm text-ink-muted">{s.salary > 0 ? `${formatMoneyCompact(s.salary)} / yr` : "No salary set"}</p>
                    </div>
                  </div>
                ),
              },
              {
                key: "dept",
                header: "Department",
                cell: (s) => (s.department !== "—" ? <span className={deptBadgeClass(s.department)}>{s.department}</span> : <span className="text-ink-faint">—</span>),
              },
              {
                key: "gross",
                header: "Gross pay",
                align: "right",
                className: "tnum whitespace-nowrap",
                cell: (s) => {
                  const fig = figuresOf(s);
                  return fig ? <span className={slipByEmp.has(s.employeeId) ? "text-ink" : "text-ink-faint"}>{formatMoney(fig.gross)}</span> : <span className="text-body-sm text-ink-faint">Not set</span>;
                },
              },
              {
                key: "deductions",
                header: "Deductions",
                align: "right",
                className: "tnum whitespace-nowrap",
                cell: (s) => {
                  const fig = figuresOf(s);
                  return fig ? <span className={slipByEmp.has(s.employeeId) ? "text-ink-muted" : "text-ink-faint"}>{formatMoney(fig.deductions)}</span> : <span className="text-ink-faint">—</span>;
                },
              },
              {
                key: "net",
                header: "Net pay",
                align: "right",
                className: "tnum whitespace-nowrap font-semibold",
                cell: (s) => {
                  const slip = slipByEmp.get(s.employeeId);
                  const fig = figuresOf(s);
                  return fig ? (
                    <span className={slip ? "text-ink" : "text-ink-faint"} title={slip ? undefined : "Projected — not in this pay run"}>
                      {formatMoney(fig.net)}
                    </span>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  );
                },
              },
              {
                key: "edit",
                header: "Edit salary",
                srOnlyHeader: true,
                align: "right",
                cell: (s) => (
                  // Sits above the stretched row button (relative z-10). 48px
                  // hit area on tablets via an invisible ::before; compact on desktop.
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation(); // don't also select the row
                      editSalary(s);
                    }}
                    aria-label={`Edit ${s.name}'s salary`}
                    title="Edit salary"
                    className="relative z-10 inline-grid h-8 w-8 place-items-center rounded-full text-ink-faint transition-colors before:absolute before:-inset-2 before:content-[''] hover:bg-surface-2 hover:text-ink lg:before:hidden"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
                ),
              },
            ]}
            renderRow={(s) => {
              const fig = figuresOf(s);
              return (
                <ListRow
                  onClick={() => {
                    setSelectedEmpId(s.employeeId);
                    setSheetEmpId(s.employeeId);
                  }}
                  label={`${s.name}, open payslip`}
                  leading={<Avatar name={s.name} department={s.department} size="h-10 w-10" />}
                  title={s.name}
                  subtitle={s.department}
                  meta={fig ? <span className={`text-body-md font-semibold ${slipByEmp.has(s.employeeId) ? "text-ink" : "text-ink-muted"}`}>{formatMoney(fig.net)}</span> : undefined}
                  trailing={staffStatus(s)}
                />
              );
            }}
          />

          <div className="flex flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between md:px-5">
            <p className="text-body-sm text-ink-muted">
              {staff.length
                ? `Showing ${safePage * PAGE_SIZE + 1}–${Math.min(staff.length, (safePage + 1) * PAGE_SIZE)} of ${plural(staff.length, "team member")}`
                : "Showing 0 team members"}
              {selectedRun && " · faded figures are projected (not in this run)"}
            </p>
            <div className="flex items-center justify-between gap-2 sm:justify-end">
              <button
                type="button"
                onClick={() => setPage(safePage - 1)}
                disabled={safePage === 0}
                aria-label="Previous page"
                className="grid size-tap place-items-center rounded-full border border-border text-ink transition-colors hover:bg-bg disabled:opacity-40 lg:size-8"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
              </button>
              <span className="tnum text-label-sm text-ink">
                Page {safePage + 1} of {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setPage(safePage + 1)}
                disabled={safePage >= pageCount - 1}
                aria-label="Next page"
                className="grid size-tap place-items-center rounded-full border border-border text-ink transition-colors hover:bg-bg disabled:opacity-40 lg:size-8"
              >
                <ChevronRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </div>

        {/* Individual payslip panel. Phones use the bottom sheet instead, so it's hidden there. */}
        <aside aria-label="Payslip" className="hidden min-w-0 rounded-xl border border-border bg-surface p-5 md:block xl:sticky xl:top-[calc(var(--spacing-topbar)+1rem)]">
          {focus ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3 border-b border-border pb-4">
                <Avatar name={focus.name} department={focus.department} size="h-11 w-11" />
                <div className="min-w-0">
                  <p className="truncate font-display text-headline-sm text-ink">{focus.name}</p>
                  <p className="text-body-sm text-ink-muted">{focus.department}</p>
                  <p className="text-body-sm text-ink-faint">
                    {slipByEmp.has(focus.employeeId) ? `In ${periodLabel(selectedRun!.period)} run` : selectedRun ? "Not in this pay run" : "No pay run yet"}
                  </p>
                </div>
              </div>
              <PayslipBreakdown employee={focus} slip={slipByEmp.get(focus.employeeId)} />
              <button type="button" onClick={() => editSalary(focus)} className={`${buttonClass("secondary", { block: true })} border-ink`}>
                <Pencil className="h-4 w-4" aria-hidden />
                Edit salary
              </button>
            </div>
          ) : (
            <p className="py-10 text-center text-body-md text-ink-muted">Select an employee to see their payslip.</p>
          )}
        </aside>
      </section>

      {/* ── Pay run history ── */}
      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex min-w-0 flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="font-display text-headline-sm text-ink">Pay run history</h2>
            <p className="text-body-sm text-ink-muted">Every cycle so far — select one to inspect it above.</p>
          </div>
          <FilterBar
            activeCount={runFilterCount}
            onReset={() => {
              setStatusFilter("all");
              setYearFilter("all");
            }}
            search={
              <div className="relative w-full md:w-56">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
                <input
                  type="search"
                  autoComplete="off"
                  enterKeyHint="search"
                  aria-label="Search pay periods"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search pay periods…"
                  className={searchInput}
                />
              </div>
            }
          >
            <select aria-label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${control} md:w-auto`}>
              <option value="all">All statuses</option>
              <option value="Draft">Draft</option>
              <option value="Finalized">Finalized</option>
            </select>
            <select aria-label="Year" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className={`${control} md:w-auto`}>
              <option value="all">All years</option>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </FilterBar>
        </div>
        <ResponsiveList
          inset
          caption="Pay run history"
          rows={visibleRuns}
          getKey={(r) => r.id}
          listClassName="px-4"
          rowClassName={(r) => `relative cursor-pointer ${r.id === selectedRun?.id ? "bg-bg" : ""}`}
          empty={
            <EmptyState
              icon={Receipt}
              title={payRuns.length ? "No matching pay runs" : "No pay runs yet"}
              description={payRuns.length ? "Try a different filter." : "Tap “New pay run” to generate payslips."}
            />
          }
          columns={[
            {
              key: "period",
              header: "Pay period",
              cell: (r) => {
                const pd = payDateOf(r.period);
                return (
                  <>
                    <p className="font-semibold text-ink">
                      {periodLabel(r.period)}
                      {r.period === currentPeriod && <span className="ml-2 text-body-sm font-normal text-ink-muted">Current</span>}
                    </p>
                    <p className="text-body-sm text-ink-muted">{pd ? `${r.status === "Finalized" ? "Paid" : "Pays out"} ${shortDate(pd)}` : r.period}</p>
                  </>
                );
              },
            },
            { key: "slips", header: "Payslips", align: "right", className: "tnum text-ink-muted", cell: (r) => r.payslips.length },
            { key: "net", header: "Total net", align: "right", className: "tnum whitespace-nowrap font-semibold text-ink", cell: (r) => formatMoney(sum(r, "net")) },
            { key: "status", header: "Status", cell: (r) => <RunStatus status={r.status} /> },
            {
              key: "action",
              header: "Action",
              align: "right",
              cell: (r) => {
                const active = r.id === selectedRun?.id;
                // The button stretches over the whole row (before:inset-0), so
                // clicking anywhere on the row inspects that run, as before.
                return (
                  <button
                    type="button"
                    onClick={() => setSelectedRunId(r.id)}
                    aria-pressed={active}
                    aria-label={`Inspect ${periodLabel(r.period)} pay run`}
                    className={`inline-flex min-h-tap items-center rounded-full px-3 text-label-sm before:absolute before:inset-0 before:content-[''] lg:min-h-8 ${
                      active ? "bg-navy text-on-navy" : "border border-border text-ink-muted"
                    }`}
                  >
                    {active ? "Inspecting" : "Inspect"}
                  </button>
                );
              },
            },
          ]}
          renderRow={(r) => {
            const pd = payDateOf(r.period);
            const active = r.id === selectedRun?.id;
            return (
              <ListRow
                onClick={() => {
                  setSelectedRunId(r.id);
                  // The run's details are at the top of the page, so take the user there.
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                label={`Inspect ${periodLabel(r.period)} pay run`}
                className={active ? "-mx-4 bg-bg px-4" : ""}
                title={
                  <>
                    {periodLabel(r.period)}
                    {active && <span className="ml-2 text-body-sm font-normal text-ink-muted">· Inspecting</span>}
                  </>
                }
                subtitle={`${plural(r.payslips.length, "payslip")} · ${pd ? `${r.status === "Finalized" ? "Paid" : "Pays out"} ${shortDate(pd)}` : r.period}`}
                meta={<span className="font-semibold">{formatMoney(sum(r, "net"))}</span>}
                trailing={<RunStatus status={r.status} />}
              />
            );
          }}
        />
      </section>

      {/* Phones: one person's payslip breakdown, opened from a staff row. */}
      <BottomSheet
        open={sheetEmp !== null}
        onClose={closeSheet}
        eyebrow={sheetEmp ? (slipByEmp.has(sheetEmp.employeeId) ? `In ${periodLabel(selectedRun!.period)} run` : selectedRun ? "Not in this pay run" : "No pay run yet") : undefined}
        title={sheetEmp?.name ?? "Payslip"}
        description={sheetEmp?.department}
        footer={
          sheetEmp && (
            <button
              type="button"
              onClick={() => {
                const s = sheetEmp;
                setSheetEmpId(null);
                editSalary(s);
              }}
              className={`${buttonClass("navy")} flex-1 md:ml-auto md:flex-none`}
            >
              <Pencil className="h-4 w-4" aria-hidden />
              Edit salary
            </button>
          )
        }
      >
        {sheetEmp && <PayslipBreakdown employee={sheetEmp} slip={slipByEmp.get(sheetEmp.employeeId)} />}
      </BottomSheet>

      {/* Phones/tablets: the main action as a full-width yellow pill pinned
          just above the tab bar (same spot the Fab uses). The spacer stops it
          covering the last row of the page. */}
      <div aria-hidden className="h-20 lg:hidden" />
      <div className="fixed inset-x-0 bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom)+0.75rem)] z-30 px-gutter md:px-8 lg:hidden">
        <button
          type="button"
          onClick={primary.onClick}
          disabled={isPending}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 text-label-md font-semibold text-on-accent shadow-[0_0_0_1px_rgb(16_27_58/0.08)] transition-colors hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-60"
        >
          {isPending ? "Saving…" : primary.label}
          {!isPending && primary.icon}
        </button>
      </div>

      <ConfirmSheet confirmation={confirmation} onClose={closeConfirm} />
      <SalaryModal open={salaryModalOpen} employee={editingSalary} onClose={closeSalary} onSave={handleSaveSalary} />
      <PayRunModal open={runModalOpen} defaultPeriod={currentPeriod} onClose={closeRun} onCreate={handleCreateRun} />
    </div>
  );
}

// "Finalized" / "Draft" with an icon + words (never colour alone).
function RunStatus({ status }: { status: string }) {
  return status === "Finalized" ? (
    <StatusText tone="good" variant="pill">
      Finalized
    </StatusText>
  ) : (
    <StatusText tone="pending" variant="pill">
      {status}
    </StatusText>
  );
}

/*
  The gross → deductions → net breakdown for one person. Shared by the
  desktop side panel and the phone bottom sheet so both always match.
*/
function PayslipBreakdown({ employee, slip }: { employee: SalaryRow; slip: PayslipRow | undefined }) {
  const figures = slip ?? (employee.salary > 0 ? computePayslip(employee.salary) : null);
  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-bg p-4">
        <p className={`${caps} text-ink-muted`}>{slip ? "Net take-home pay" : "Projected take-home pay"}</p>
        <p className="tnum mt-1 font-display text-metric-md text-ink [overflow-wrap:anywhere]">{figures ? formatMoney(figures.net) : "—"}</p>
        <p className="mt-1 text-body-sm text-ink-muted">{figures ? "Per month, after estimated deductions" : "Set a salary to calculate pay"}</p>
      </div>

      {figures && (
        <>
          <div>
            <div className={`mb-2 flex items-center justify-between gap-2 ${caps} text-ink-muted`}>
              <span>Gross earnings</span>
              <span className="tnum text-ink">{formatMoney(figures.gross)}</span>
            </div>
            <dl className="space-y-2 rounded-lg border border-border p-3 text-body-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-muted">Base salary (monthly)</dt>
                <dd className="tnum text-ink">{formatMoney(figures.gross)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-ink-muted">Annual salary (current)</dt>
                <dd className="tnum text-ink">{formatMoney(employee.salary)}</dd>
              </div>
            </dl>
          </div>
          <div>
            <div className={`mb-2 flex items-center justify-between gap-2 ${caps} text-ink-muted`}>
              <span>Deductions</span>
              <span className="tnum text-critical">−{formatMoney(figures.deductions)}</span>
            </div>
            <dl className="rounded-lg border border-border p-3 text-body-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-ink-muted">Tax &amp; statutory (est. {Math.round(DEDUCTION_RATE * 100)}%)</dt>
                <dd className="tnum text-ink">−{formatMoney(figures.deductions)}</dd>
              </div>
            </dl>
          </div>
        </>
      )}
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
        <p className="flex min-w-0 items-center gap-2 text-label-md text-ink">
          <span className="shrink-0 text-ink-muted">{icon}</span>
          {title}
        </p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-label-sm font-bold ${tagClass}`}>{tag}</span>
      </div>
      {names.length > 0 && (
        <p className="mt-1 text-body-sm text-ink-muted [overflow-wrap:anywhere]">
          {names.slice(0, 3).join(", ")}
          {names.length > 3 && ` +${names.length - 3} more`}
        </p>
      )}
    </li>
  );
}
