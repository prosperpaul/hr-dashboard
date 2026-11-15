"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Download } from "lucide-react";
import {
  usedAllowanceDays,
  leaveStyle,
  formatLeaveRange,
  type LeaveRow,
  type LeaveInput,
  type LeaveEmployee,
} from "@/lib/leave";
import { createLeaveRequest, setLeaveStatus, deleteLeaveRequest } from "@/lib/leave-actions";
import StatCard, { type DashStat } from "@/components/dashboard/StatCard";
import { Pill } from "@/components/dashboard/Panel";
import LeaveRequestModal from "./LeaveRequestModal";
import LeaveCalendar from "./LeaveCalendar";
import LeaveQueue from "./LeaveQueue";
import LeaveBalances, { type BalanceRow } from "./LeaveBalances";

const DAY = 86_400_000;
const parseDay = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function LeaveManager({
  requests,
  employees,
  canManage,
  selfEmployeeId = null,
  today,
}: {
  requests: LeaveRow[];
  employees: LeaveEmployee[];
  canManage: boolean;
  // The linked employee id of the current user (self-service). Null if none.
  selfEmployeeId?: string | null;
  today: string; // "YYYY-MM-DD", decided on the server
}) {
  const router = useRouter();
  // Self-service mode: not a manager, but linked to an employee record.
  const isSelf = !canManage && !!selfEmployeeId;
  const canRequest = canManage || isSelf;

  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // ── Dates ─────────────────────────────────────────────────────────
  const todayDate = parseDay(today);
  const year = todayDate.getFullYear();
  const monthPrefix = today.slice(0, 7); // "2026-11"
  const lastMonthPrefix = ymd(new Date(year, todayDate.getMonth() - 1, 1)).slice(0, 7);
  const weekAhead = ymd(new Date(todayDate.getTime() + 6 * DAY));
  const twoDaysAgo = ymd(new Date(todayDate.getTime() - 2 * DAY));

  // ── Balances per employee ─────────────────────────────────────────
  const byEmployee = new Map<string, LeaveRow[]>();
  for (const r of requests) byEmployee.set(r.employeeId, [...(byEmployee.get(r.employeeId) ?? []), r]);

  const balances: BalanceRow[] = employees.map((e) => {
    const mine = byEmployee.get(e.id) ?? [];
    const used = usedAllowanceDays(mine, year);
    const upcoming =
      mine
        .filter((r) => r.status !== "Rejected" && r.endDate >= today)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null;
    return {
      id: e.id,
      name: e.name,
      email: e.email,
      department: e.department,
      allowance: e.leaveAllowance,
      used,
      remaining: Math.max(0, e.leaveAllowance - used),
      upcoming,
    };
  });
  const balanceById = new Map(balances.map((b) => [b.id, b]));
  const remainingFor = (id: string) => {
    const b = balanceById.get(id);
    return b ? { remaining: b.remaining, allowance: b.allowance } : null;
  };

  // ── Headline numbers ──────────────────────────────────────────────
  const pending = requests.filter((r) => r.status === "Pending");
  const approved = requests.filter((r) => r.status === "Approved");
  const approvedThisMonth = approved.filter((r) => r.startDate.startsWith(monthPrefix));
  const approvedLastMonth = approved.filter((r) => r.startDate.startsWith(lastMonthPrefix));
  const daysOf = (rows: LeaveRow[]) => rows.reduce((s, r) => s + r.days, 0);
  const offToday = approved.filter((r) => r.startDate <= today && r.endDate >= today);
  const offByType = Object.entries(
    offToday.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.type]: (acc[r.type] ?? 0) + 1 }), {}),
  ).sort((a, b) => b[1] - a[1]);

  const avgRemaining = balances.length ? Math.round((balances.reduce((s, b) => s + b.remaining, 0) / balances.length) * 10) / 10 : 0;
  const avgAllowance = balances.length ? Math.round(balances.reduce((s, b) => s + b.allowance, 0) / balances.length) : 0;
  const lowBalance = balances.filter((b) => b.allowance > 0 && b.remaining / b.allowance < 0.25).length;

  const typeDots = (rows: [string, number][]) =>
    rows.length ? (
      <div className="mb-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-label-sm text-ink-faint">
        {rows.slice(0, 3).map(([type, n]) => (
          <span key={type} className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${leaveStyle(type).dot}`} />
            <span className="tnum">{n}</span> {type}
          </span>
        ))}
      </div>
    ) : undefined;

  const managerStats: DashStat[] = [
    {
      key: "pending",
      label: "Pending requests",
      value: String(pending.length),
      badge: pending.length > 0 ? { text: "Requires action", dot: true } : { text: "All clear", tone: "neutral" },
      side: <span className="mb-1 mr-auto ml-2 text-body-sm text-ink-faint">awaiting approval</span>,
      footer: {
        label: "Submitted in last 48h",
        value: String(pending.filter((r) => r.createdAt.slice(0, 10) >= twoDaysAgo).length),
      },
    },
    {
      key: "approved",
      label: "Approved this month",
      value: String(daysOf(approvedThisMonth)),
      side: <span className="mb-1 mr-auto ml-2 text-body-sm text-ink-faint">days · {approvedThisMonth.length} requests</span>,
      badge: (() => {
        const diff = daysOf(approvedThisMonth) - daysOf(approvedLastMonth);
        return diff === 0 ? undefined : { text: `${diff > 0 ? "+" : "−"}${Math.abs(diff)}d vs last mo`, tone: "neutral" as const };
      })(),
      footer: { label: "Last month", value: `${daysOf(approvedLastMonth)} days` },
    },
    {
      key: "today",
      label: "On leave today",
      value: String(offToday.length),
      badge: { text: `${employees.length ? Math.round((offToday.length / employees.length) * 1000) / 10 : 0}% of team`, tone: "neutral" },
      side: typeDots(offByType),
      footer: { label: "Back within 7 days", value: String(offToday.filter((r) => r.endDate <= weekAhead).length) },
    },
    {
      key: "balance",
      label: "Average balance",
      value: `${avgRemaining}d`,
      badge: { text: `of ${avgAllowance}d allowance`, tone: "neutral" },
      bar: [
        { value: avgRemaining, className: "bg-accent" },
        { value: Math.max(avgAllowance - avgRemaining, 0), className: "bg-transparent" },
      ],
      footer: { label: "Under 25% left", value: `${lowBalance} ${lowBalance === 1 ? "person" : "people"}` },
    },
  ];

  // Self-service: the balance is the headline.
  const mine = balances[0];
  const nextOff = mine?.upcoming;
  const selfStats: DashStat[] = mine
    ? [
        {
          key: "remaining",
          label: "Days remaining",
          value: String(mine.remaining),
          side: <span className="mb-1 mr-auto ml-2 text-body-sm text-ink-faint">of {mine.allowance}</span>,
          bar: [
            { value: mine.remaining, className: "bg-accent" },
            { value: mine.used, className: "bg-transparent" },
          ],
          footer: { label: "Leave year", value: String(year) },
        },
        { key: "used", label: "Days used", value: String(mine.used), footer: { label: "Approved Vacation & Personal", value: "" } },
        {
          key: "mypending",
          label: "Pending requests",
          value: String(pending.length),
          badge: pending.length > 0 ? { text: "Awaiting approval", dot: true } : undefined,
        },
        {
          key: "next",
          label: "Next time off",
          value: nextOff ? formatLeaveRange(nextOff.startDate, nextOff.endDate) : "—",
          footer: nextOff ? { label: nextOff.type, value: nextOff.status, accent: nextOff.status === "Approved" } : { label: "Nothing scheduled", value: "" },
        },
      ]
    : [];

  // ── Actions (every one is re-checked on the server) ───────────────
  function act(fn: () => Promise<void>, after?: () => void) {
    startTransition(async () => {
      try {
        await fn();
        after?.();
        router.refresh(); // re-fetch so calendar, queue and balances all agree
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }
  const handleSave = (data: LeaveInput) => act(() => createLeaveRequest(data), () => setModalOpen(false));
  const handleStatus = (row: LeaveRow, status: "Approved" | "Rejected") => act(() => setLeaveStatus(row.id, status));
  function handleDelete(row: LeaveRow) {
    const what = isSelf ? "Cancel your" : `Delete ${row.employeeName}'s`;
    if (!window.confirm(`${what} ${row.type.toLowerCase()} request (${formatLeaveRange(row.startDate, row.endDate)})?`)) return;
    act(() => deleteLeaveRequest(row.id));
  }

  // Download every request as CSV.
  function exportCsv() {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = [
      ["Employee", "Department", "Type", "Start", "End", "Days", "Status", "Reason", "Submitted"],
      ...requests.map((r) => [r.employeeName, r.department ?? "", r.type, r.startDate, r.endDate, r.days, r.status, r.reason ?? "", r.createdAt.slice(0, 10)]),
    ];
    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `leave-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const departments = [...new Set(employees.map((e) => e.department).filter((d): d is string => !!d))].sort();

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-label-sm uppercase tracking-wider text-ink-faint">
            <span>Operations</span>
            <span>/</span>
            <span className="normal-case tracking-normal text-ink-muted">Leave</span>
            <Pill tone="accent" dot>
              Leave year {year}
            </Pill>
          </div>
          <h1 className="text-headline-lg text-ink md:text-headline-xl">{canManage ? "Leave Management" : "My Leave"}</h1>
          <p className="max-w-2xl text-body-md text-ink-muted">
            {isPending
              ? "Working…"
              : canManage
                ? "Review time off, track balances against allowances, and approve pending requests."
                : "Request time off and keep track of your balance."}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={requests.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 text-label-md text-ink transition-colors hover:border-border-strong hover:bg-white/[0.03] disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          {canRequest && (
            <button
              onClick={() => setModalOpen(true)}
              disabled={isPending || employees.length === 0}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-label-md font-semibold text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] transition-colors hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Request leave
            </button>
          )}
        </div>
      </section>

      {/* ── KPI cards ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(isSelf ? selfStats : managerStats).map((s) => (
          <StatCard key={s.key} stat={s} />
        ))}
      </section>

      {/* ── Calendar + queue ── */}
      <section className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <LeaveCalendar requests={requests} departments={canManage ? departments : []} today={today} />
        </div>
        <div className="xl:col-span-4">
          <LeaveQueue
            requests={requests}
            remainingFor={remainingFor}
            canManage={canManage}
            isSelf={isSelf}
            busy={isPending}
            onStatus={handleStatus}
            onDelete={handleDelete}
          />
        </div>
      </section>

      {/* ── Balances (managers only — self-service sees theirs in the cards) ── */}
      {canManage && <LeaveBalances rows={balances} year={year} />}

      <LeaveRequestModal
        open={modalOpen}
        employees={employees}
        fixedEmployeeId={isSelf ? selfEmployeeId : undefined}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
