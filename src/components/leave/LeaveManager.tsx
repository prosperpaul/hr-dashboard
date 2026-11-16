"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Download, ShieldCheck } from "lucide-react";
import {
  usedAllowanceDays,
  ALLOWANCE_TYPES,
  formatLeaveRange,
  type LeaveRow,
  type LeaveInput,
  type LeaveEmployee,
} from "@/lib/leave";
import { createLeaveRequest, setLeaveStatus, deleteLeaveRequest } from "@/lib/leave-actions";
import LeaveRequestModal from "./LeaveRequestModal";
import LeaveCalendar from "./LeaveCalendar";
import LeaveQueue from "./LeaveQueue";
import LeaveList from "./LeaveList";
import LeaveBalances, { BalanceSpotlight, type BalanceRow } from "./LeaveBalances";

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
  const weekAhead = ymd(new Date(todayDate.getTime() + 6 * DAY)); // today + 6 days

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
  const offToday = approved.filter((r) => r.startDate <= today && r.endDate >= today);
  const offTodayPeople = new Set(offToday.map((r) => r.employeeId)).size;
  // People off today whose leave ends within the next 7 days.
  const returningThisWeek = new Set(offToday.filter((r) => r.endDate <= weekAhead).map((r) => r.employeeId)).size;
  // Share of the team NOT on approved leave today.
  const capacity = employees.length ? Math.round(((employees.length - offTodayPeople) / employees.length) * 100) : 100;

  const avgRemaining = balances.length ? Math.round((balances.reduce((s, b) => s + b.remaining, 0) / balances.length) * 10) / 10 : 0;
  const avgAllowance = balances.length ? Math.round(balances.reduce((s, b) => s + b.allowance, 0) / balances.length) : 0;
  const lowBalance = balances.filter((b) => b.allowance > 0 && b.remaining / b.allowance < 0.25).length;
  const totalAllowance = balances.reduce((s, b) => s + b.allowance, 0);
  const totalUsed = balances.reduce((s, b) => s + b.used, 0);
  // Approved sick days that started this year (they don't touch the allowance).
  const sickDays = approved.filter((r) => r.type === "Sick" && r.startDate.startsWith(String(year))).reduce((s, r) => s + r.days, 0);
  const pct = (a: number, b: number) => (b ? (a / b) * 100 : 0);

  // ── View state: which tab, which month, which department ──────────
  const [tab, setTab] = useState<"timeline" | "Pending" | "Approved" | "Rejected">("timeline");
  const [month, setMonth] = useState(today.slice(0, 7)); // "YYYY-MM" shown on the timeline
  const [dept, setDept] = useState("all");
  const departments = [...new Set(employees.map((e) => e.department).filter((d): d is string => !!d))].sort();
  const inDept = (r: LeaveRow) => dept === "all" || r.department === dept;
  const deptRequests = requests.filter(inDept);

  // People with (non-declined) leave touching the shown month — the timeline tab count.
  const [my, mm] = month.split("-").map(Number);
  const monthEnd = `${month}-${String(new Date(my, mm, 0).getDate()).padStart(2, "0")}`;
  const offInMonth = new Set(
    deptRequests.filter((r) => r.status !== "Rejected" && r.startDate <= monthEnd && r.endDate >= `${month}-01`).map((r) => r.employeeId),
  ).size;

  const tabs = [
    { key: "timeline" as const, label: "Timeline", count: offInMonth },
    { key: "Pending" as const, label: "Pending", count: deptRequests.filter((r) => r.status === "Pending").length },
    { key: "Approved" as const, label: "Approved", count: deptRequests.filter((r) => r.status === "Approved").length },
    { key: "Rejected" as const, label: "Declined", count: deptRequests.filter((r) => r.status === "Rejected").length },
  ];

  // Self-service figures.
  const mine = balances[0];
  const nextOff = mine?.upcoming;
  const pendingAllowanceDays = pending.filter((r) => ALLOWANCE_TYPES.includes(r.type)).reduce((s, r) => s + r.days, 0);

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

  // The one-line summary under the headline.
  const summary = isSelf
    ? [
        { text: `${mine?.remaining ?? 0} of ${mine?.allowance ?? 0}`, rest: "days left", dot: true },
        { text: String(pending.length), rest: "pending approval" },
        { text: nextOff ? formatLeaveRange(nextOff.startDate, nextOff.endDate) : "Nothing", rest: nextOff ? `next (${nextOff.type})` : "scheduled" },
      ]
    : [
        { text: String(offTodayPeople), rest: "on leave today", dot: true },
        { text: String(pending.length), rest: "pending approval" },
        { text: String(returningThisWeek), rest: "returning this week" },
        { text: `${capacity}%`, rest: "of the team available today" },
      ];

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <section className="flex flex-col justify-between gap-5 border-b border-border pb-6 lg:flex-row lg:items-start">
        <div className="min-w-0 space-y-2">
          <p className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">
            <span>Operations</span>
            <span className="h-1 w-1 rounded-full bg-accent" />
            <span>Time off &amp; absence calendar</span>
          </p>
          <h1 className="text-headline-lg text-ink md:text-headline-xl">{canManage ? "Who’s off, and when." : "Your time off, at a glance."}</h1>
          <p className="max-w-2xl text-body-md text-ink-muted">
            {isPending
              ? "Working…"
              : canManage
                ? `Team availability, pending approvals and ${year} allowance balances across ${employees.length} ${employees.length === 1 ? "person" : "people"} in ${departments.length} ${departments.length === 1 ? "department" : "departments"}.`
                : `Request time off, track what's pending, and keep an eye on your ${year} allowance.`}
          </p>
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-body-sm text-ink-muted">
            {summary.map((s, i) => (
              <li key={s.rest} className="flex items-center gap-1.5">
                {i > 0 && <span className="mr-1.5 text-border-strong">/</span>}
                {s.dot && <span className="h-2 w-2 rounded-full bg-critical" />}
                <span className="tnum font-bold text-ink">{s.text}</span> {s.rest}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={requests.length === 0}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-5 text-label-md text-ink transition-colors hover:bg-bg disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          {canRequest && (
            <button
              onClick={() => setModalOpen(true)}
              disabled={isPending || employees.length === 0}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-label-md font-semibold text-on-accent transition-colors hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Request leave
            </button>
          )}
        </div>
      </section>

      {/* ── Tabs: the timeline, or a list of requests in one status ── */}
      <nav className="flex gap-6 overflow-x-auto border-b border-border" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={[
              "-mb-px flex shrink-0 items-center gap-2 border-b-2 pb-3 pt-1 font-display text-label-md font-semibold transition-colors",
              tab === t.key ? "border-ink text-ink" : "border-transparent text-ink-muted hover:text-ink",
            ].join(" ")}
          >
            {t.label}
            <span
              className={[
                "tnum rounded-full px-2 text-[11px] font-bold",
                tab === t.key ? "bg-navy text-on-navy" : t.key === "Pending" && t.count > 0 ? "bg-critical/10 text-critical" : "bg-surface-2 text-ink-muted",
              ].join(" ")}
            >
              {t.count}
            </span>
          </button>
        ))}
      </nav>

      {/* ── Main column + right rail ── */}
      <section className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          {tab === "timeline" ? (
            <LeaveCalendar
              requests={deptRequests}
              departments={canManage ? departments : []}
              today={today}
              month={month}
              onMonthChange={setMonth}
              dept={dept}
              onDeptChange={setDept}
            />
          ) : (
            <LeaveList
              rows={deptRequests.filter((r) => r.status === tab)}
              status={tab}
              canManage={canManage}
              isSelf={isSelf}
              busy={isPending}
              onStatus={handleStatus}
              onDelete={handleDelete}
            />
          )}
        </div>

        <div className="space-y-6 xl:col-span-4">
          <LeaveQueue
            pending={pending}
            allRequests={requests}
            today={today}
            weekAhead={weekAhead}
            remainingFor={remainingFor}
            canManage={canManage}
            isSelf={isSelf}
            busy={isPending}
            onStatus={handleStatus}
            onDelete={handleDelete}
          />

          {isSelf && mine ? (
            <BalanceSpotlight
              eyebrow="Balance spotlight"
              title={`Your ${year} allowance`}
              badge={mine.department ?? undefined}
              items={[
                {
                  label: "Paid allowance",
                  figure: `${mine.remaining} of ${mine.allowance}d remaining`,
                  pct: pct(mine.remaining, mine.allowance),
                  note: "Vacation and Personal days count against it",
                  warn: mine.allowance > 0 && mine.remaining / mine.allowance < 0.25,
                },
                { label: "Days used", figure: `${mine.used}d approved`, pct: pct(mine.used, mine.allowance) },
                { label: "Waiting for approval", figure: `${pendingAllowanceDays}d of allowance` },
                { label: "Sick leave taken", figure: `${sickDays}d this year`, note: "Doesn't reduce your allowance" },
              ]}
            />
          ) : canManage ? (
            <BalanceSpotlight
              eyebrow="Balance spotlight"
              title="Whole team"
              badge={`${employees.length} ${employees.length === 1 ? "member" : "members"}`}
              items={[
                {
                  label: "Average balance",
                  figure: `${avgRemaining} of ${avgAllowance}d remaining`,
                  pct: pct(avgRemaining, avgAllowance),
                  note: "Paid allowance per person (Vacation and Personal)",
                },
                { label: "Allowance used", figure: `${totalUsed} of ${totalAllowance}d`, pct: pct(totalUsed, totalAllowance) },
                { label: "Sick leave taken", figure: `${sickDays}d in ${year}` },
                { label: "Under 25% left", figure: `${lowBalance} ${lowBalance === 1 ? "person" : "people"}`, warn: lowBalance > 0 },
              ]}
              linkHref="#balances"
              linkLabel="View every balance"
            />
          ) : null}

          {/* How the allowance works (the app's real rule, not a made-up policy) */}
          <div className="flex gap-3 rounded-xl border border-border bg-surface-2 p-5">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-ink" />
            <div>
              <p className="font-display text-label-md font-semibold text-ink">How the {year} allowance works</p>
              <p className="mt-1 text-body-sm text-ink-muted">
                Approved Vacation and Personal days count against each person&apos;s yearly allowance. Sick and Unpaid leave don&apos;t.
                Balances count leave that starts in the current calendar year.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Balances table (managers only — self-service sees theirs in the rail) ── */}
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
