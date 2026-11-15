"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Users,
  Download,
  LayoutList,
  LayoutGrid,
  MoreHorizontal,
  Building2,
  Activity,
  X,
  Mail,
  CalendarDays,
} from "lucide-react";
import { employeeStatuses, initialsOf, type Employee, type EmployeeStatus } from "@/lib/sample-data";
import {
  createEmployee,
  updateEmployee,
  deleteEmployee,
  bulkSetDepartment,
  bulkSetStatus,
  bulkDeleteEmployees,
  type EmployeeInput,
} from "@/lib/employee-actions";
import StatCard, { type DashStat } from "@/components/dashboard/StatCard";
import StatusBadge from "./StatusBadge";
import EmployeeFormModal from "./EmployeeFormModal";

// A department option for the filter + form dropdown.
export type DeptOption = { id: string; name: string };

const PAGE_SIZES = [12, 24, 48];
const SORTS = {
  name: { label: "Name (A → Z)", fn: (a: Employee, b: Employee) => a.name.localeCompare(b.name) },
  newest: { label: "Newest hires", fn: (a: Employee, b: Employee) => b.startedAt.localeCompare(a.startedAt) },
  oldest: { label: "Longest serving", fn: (a: Employee, b: Employee) => a.startedAt.localeCompare(b.startedAt) },
  dept: { label: "Department", fn: (a: Employee, b: Employee) => a.department.localeCompare(b.department) || a.name.localeCompare(b.name) },
} as const;
type SortKey = keyof typeof SORTS;

// "YYYY-MM-DD" helpers (pure dates, no time zone involved).
const parseDay = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};
const formatDate = (iso: string) =>
  isNaN(parseDay(iso).getTime()) ? iso : parseDay(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// How long someone has worked here: "2y 3m", "5m", "New".
function tenure(start: string, today: string): string {
  const a = parseDay(start);
  const b = parseDay(today);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months--;
  if (months < 1) return "New";
  const y = Math.floor(months / 12);
  const m = months % 12;
  return y ? `${y}y${m ? ` ${m}m` : ""}` : `${m}m`;
}

export default function EmployeesManager({
  employees,
  departments,
  canManage,
  myEmployeeId,
  today,
}: {
  employees: Employee[];
  departments: DeptOption[];
  // Admin/HR may add/edit/delete. The server actions enforce the same rule
  // again, so hiding buttons is purely for convenience.
  canManage: boolean;
  myEmployeeId: string | null; // your own record, tagged "You"
  today: string; // business-time-zone date from the server
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("All");
  const [status, setStatus] = useState("All");
  const [sort, setSort] = useState<SortKey>("name");
  const [view, setView] = useState<"table" | "grid">("table");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(12);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Headline numbers ──────────────────────────────────────────────
  const count = (s: EmployeeStatus) => employees.filter((e) => e.status === s).length;
  const monthPrefix = today.slice(0, 7);
  const t = parseDay(today);
  const lastMonthPrefix = `${new Date(t.getFullYear(), t.getMonth() - 1, 1).getFullYear()}-${String(new Date(t.getFullYear(), t.getMonth() - 1, 1).getMonth() + 1).padStart(2, "0")}`;
  const quarterAgo = new Date(t.getFullYear(), t.getMonth() - 3, t.getDate());
  const newThisQuarter = employees.filter((e) => parseDay(e.startedAt) >= quarterAgo).length;
  const newThisMonth = employees.filter((e) => e.startedAt.startsWith(monthPrefix)).length;
  const newLastMonth = employees.filter((e) => e.startedAt.startsWith(lastMonthPrefix)).length;
  const deptCount = new Set(employees.map((e) => e.departmentId).filter(Boolean)).size;
  const pct = (n: number) => (employees.length ? Math.round((n / employees.length) * 1000) / 10 : 0);

  const stats: DashStat[] = [
    {
      key: "total",
      label: "Total employees",
      value: String(employees.length),
      badge: newThisQuarter > 0 ? { text: `+${newThisQuarter} this quarter`, trend: "up" } : undefined,
      footer: { label: "Unassigned to a department", value: String(employees.filter((e) => !e.departmentId).length) },
    },
    {
      key: "active",
      label: "Active",
      value: String(count("Active")),
      badge: { text: `${pct(count("Active"))}%`, dot: true },
      bar: [
        { value: count("Active"), className: "bg-accent" },
        { value: count("Remote"), className: "bg-sky-400" },
        { value: count("On Leave"), className: "bg-warning" },
      ],
      footer: { label: "Of the whole team", value: `${pct(count("Active"))}% active` },
    },
    {
      key: "away",
      label: "On leave & remote",
      value: String(count("On Leave") + count("Remote")),
      footer: { label: "On leave · Remote", value: `${count("On Leave")} · ${count("Remote")}` },
    },
    {
      key: "new",
      label: "New this month",
      value: String(newThisMonth),
      badge:
        newThisMonth !== newLastMonth
          ? { text: `${newThisMonth > newLastMonth ? "+" : "−"}${Math.abs(newThisMonth - newLastMonth)} vs last mo`, tone: newThisMonth > newLastMonth ? "accent" : "neutral" }
          : undefined,
      footer: { label: "Last month", value: String(newLastMonth) },
    },
  ];

  // ── Filter, sort, page ────────────────────────────────────────────
  const q = query.trim().toLowerCase();
  const filtered = employees
    .filter((e) => !q || e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q) || e.role.toLowerCase().includes(q))
    .filter((e) => dept === "All" || e.department === dept)
    .filter((e) => status === "All" || e.status === status)
    .sort(SORTS[sort].fn);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * pageSize, current * pageSize + pageSize);
  const resetPage = () => setPage(0);

  // ── Selection ─────────────────────────────────────────────────────
  // Only count selections that are still in the list (e.g. after a delete).
  const selectedIds = employees.filter((e) => selected.has(e.id)).map((e) => e.id);
  const allVisibleSelected = visible.length > 0 && visible.every((e) => selected.has(e.id));
  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleVisible() {
    setSelected((s) => {
      const next = new Set(s);
      visible.forEach((e) => (allVisibleSelected ? next.delete(e.id) : next.add(e.id)));
      return next;
    });
  }

  // ── Actions (every one re-checked on the server) ──────────────────
  function run(fn: () => Promise<unknown>, after?: () => void) {
    startTransition(async () => {
      try {
        await fn();
        after?.();
        router.refresh(); // reload fresh data so every number stays correct
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Something went wrong. That email may already be in use.");
      }
    });
  }
  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(e: Employee) {
    setMenuFor(null);
    setEditing(e);
    setModalOpen(true);
  }
  const handleSave = (data: EmployeeInput, id?: string) =>
    run(() => (id ? updateEmployee(id, data) : createEmployee(data)), () => setModalOpen(false));
  function handleDelete(e: Employee) {
    setMenuFor(null);
    if (window.confirm(`Remove ${e.name}? Their leave, attendance, reviews and payslips are deleted too. This can't be undone.`))
      run(() => deleteEmployee(e.id));
  }
  function bulkDept(value: string) {
    if (!value) return;
    const target = value === "__none" ? null : value;
    const name = target ? departments.find((d) => d.id === target)?.name : "Unassigned";
    if (window.confirm(`Move ${selectedIds.length} ${selectedIds.length === 1 ? "person" : "people"} to ${name}?`))
      run(() => bulkSetDepartment(selectedIds, target));
  }
  function bulkStatus(value: string) {
    if (!value) return;
    if (window.confirm(`Set ${selectedIds.length} ${selectedIds.length === 1 ? "person" : "people"} to "${value}"?`))
      run(() => bulkSetStatus(selectedIds, value as EmployeeStatus));
  }
  function bulkDelete() {
    if (window.confirm(`Delete ${selectedIds.length} employees and all their leave, attendance, reviews and payslips? This can't be undone.`))
      run(() => bulkDeleteEmployees(selectedIds), () => setSelected(new Set()));
  }

  function exportCsv(rows: Employee[], name: string) {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const data = [
      ["Name", "Email", "Role", "Department", "Status", "Start date", "Leave allowance"],
      ...rows.map((e) => [e.name, e.email, e.role, e.department, e.status, e.startedAt, e.leaveAllowance]),
    ];
    const url = URL.createObjectURL(new Blob([data.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const control =
    "h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-label-md text-ink outline-none transition-colors hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent";
  const checkbox = "h-4 w-4 cursor-pointer rounded border-border-strong accent-(--color-accent)";

  // "⋯" menu shared by table rows and grid cards.
  function rowMenu(e: Employee) {
    if (!canManage) return null;
    return (
      <div className="relative">
        <button
          onClick={() => setMenuFor(menuFor === e.id ? null : e.id)}
          aria-label={`Options for ${e.name}`}
          aria-expanded={menuFor === e.id}
          className="grid h-7 w-7 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface hover:text-ink"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuFor === e.id && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
            <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-border-strong bg-surface-2 p-1 text-left shadow-popover">
              <button onClick={() => openEdit(e)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-label-md text-ink-muted transition-colors hover:bg-surface hover:text-ink">
                <Pencil className="h-3.5 w-3.5" /> Edit details
              </button>
              <a href={`mailto:${e.email}`} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-label-md text-ink-muted transition-colors hover:bg-surface hover:text-ink">
                <Mail className="h-3.5 w-3.5" /> Send email
              </a>
              <div className="my-1 border-t border-border" />
              <button onClick={() => handleDelete(e)} className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-label-md text-critical transition-colors hover:bg-critical/10">
                <Trash2 className="h-3.5 w-3.5" /> Remove employee
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-label-sm uppercase tracking-wider text-ink-faint">
            <span>Main</span>
            <span>/</span>
            <span className="normal-case tracking-normal text-accent-hover">Employees · Directory</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-headline-lg text-ink md:text-headline-xl">Employees</h1>
            <span className="text-body-md text-ink-muted">
              {isPending ? "Saving…" : `${employees.length} people across ${deptCount} ${deptCount === 1 ? "department" : "departments"}`}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => exportCsv(filtered, "employees")}
            disabled={filtered.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 text-label-md text-ink transition-colors hover:border-border-strong hover:bg-white/[0.03] disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          {canManage && (
            <button
              onClick={openAdd}
              disabled={isPending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-label-md font-semibold text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] transition-colors hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Add employee
            </button>
          )}
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
            onChange={(e) => {
              setQuery(e.target.value);
              resetPage();
            }}
            placeholder="Search by name, email or role…"
            className="h-9 w-full rounded-lg border border-border bg-surface-2 pl-8 pr-3 text-body-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Department" value={dept} onChange={(e) => { setDept(e.target.value); resetPage(); }} className={control}>
            <option value="All">All departments ({departments.length})</option>
            {departments.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
            <option value="Unassigned">Unassigned</option>
          </select>
          <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); resetPage(); }} className={control}>
            <option value="All">Status: All</option>
            {employeeStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
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
          <div className="flex rounded-lg border border-border bg-bg p-0.5" role="group" aria-label="View">
            {(["table", "grid"] as const).map((v) => {
              const Icon = v === "table" ? LayoutList : LayoutGrid;
              return (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  aria-label={`${v} view`}
                  className={`grid h-8 w-8 place-items-center rounded-md transition-colors ${view === v ? "bg-surface-2 text-accent-hover" : "text-ink-faint hover:text-ink"}`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Bulk action bar (appears when people are selected) ── */}
      {canManage && selectedIds.length > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="tnum text-label-md text-ink">
              {selectedIds.length} {selectedIds.length === 1 ? "employee" : "employees"} selected
            </span>
            <button onClick={() => setSelected(new Set())} className="inline-flex items-center gap-1 text-label-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline">
              <X className="h-3 w-3" /> Deselect all
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => exportCsv(employees.filter((e) => selected.has(e.id)), "employees-selected")}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-label-sm text-ink transition-colors hover:border-border-strong"
            >
              <Download className="h-3.5 w-3.5" /> Export selected
            </button>
            <label className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface pl-2.5 text-label-sm text-ink">
              <Building2 className="h-3.5 w-3.5 text-ink-faint" />
              <select value="" onChange={(e) => bulkDept(e.target.value)} disabled={isPending} className="h-full rounded-r-lg bg-transparent pr-2 outline-none">
                <option value="">Change department…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
                <option value="__none">Unassigned</option>
              </select>
            </label>
            <label className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface pl-2.5 text-label-sm text-ink">
              <Activity className="h-3.5 w-3.5 text-ink-faint" />
              <select value="" onChange={(e) => bulkStatus(e.target.value)} disabled={isPending} className="h-full rounded-r-lg bg-transparent pr-2 outline-none">
                <option value="">Change status…</option>
                {employeeStatuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <button
              onClick={bulkDelete}
              disabled={isPending}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-critical/40 bg-critical/10 px-2.5 text-label-sm text-critical transition-colors hover:bg-critical/20 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </section>
      )}

      {/* ── Table view ── */}
      {view === "table" ? (
        <section className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] leading-[18px]">
              <thead>
                <tr className="border-b border-border text-label-sm uppercase tracking-[0.05em] text-ink-faint">
                  {canManage && (
                    <th className="w-10 py-3 pl-5">
                      <input type="checkbox" aria-label="Select all on this page" checked={allVisibleSelected} onChange={toggleVisible} className={checkbox} />
                    </th>
                  )}
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Role / title</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Department</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">Start date</th>
                  <th className="hidden px-4 py-3 text-right font-medium xl:table-cell">Leave / yr</th>
                  <th className="w-12 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => {
                  const isSel = selected.has(e.id);
                  return (
                    <tr key={e.id} className={`h-14 border-b border-border last:border-0 ${isSel ? "bg-accent-soft" : "hover:bg-surface-2"}`}>
                      {canManage && (
                        <td className="py-2.5 pl-5">
                          <input type="checkbox" aria-label={`Select ${e.name}`} checked={isSel} onChange={() => toggle(e.id)} className={checkbox} />
                        </td>
                      )}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent-hover">
                            {initialsOf(e.name)}
                          </div>
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate font-medium text-ink">
                              {e.name}
                              {e.id === myEmployeeId && <span className="rounded border border-accent/30 bg-accent-soft px-1 text-[10px] text-accent-hover">You</span>}
                            </p>
                            <p className="truncate text-body-sm text-ink-faint">{e.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-2.5 text-ink-muted md:table-cell">{e.role}</td>
                      <td className="hidden px-4 py-2.5 lg:table-cell">
                        {e.departmentId ? (
                          <span className="rounded-md border border-border bg-surface-2 px-2 py-0.5 text-label-sm text-ink-muted">{e.department}</span>
                        ) : (
                          <span className="text-body-sm text-ink-faint">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={e.status} />
                      </td>
                      <td className="hidden px-4 py-2.5 sm:table-cell">
                        <p className="tnum text-ink">{formatDate(e.startedAt)}</p>
                        <p className="text-body-sm text-ink-faint">{tenure(e.startedAt, today)}</p>
                      </td>
                      <td className="tnum hidden px-4 py-2.5 text-right text-ink-muted xl:table-cell">{e.leaveAllowance} days</td>
                      <td className="px-4 py-2.5 text-right">{rowMenu(e)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visible.length === 0 && <EmptyState hasEmployees={employees.length > 0} canManage={canManage} />}
          </div>
          <Pager current={current} pages={pages} pageSize={pageSize} total={filtered.length} shown={visible.length} onPage={setPage} onSize={(n) => { setPageSize(n); resetPage(); }} />
        </section>
      ) : (
        /* ── Grid view ── */
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {visible.map((e) => {
              const isSel = selected.has(e.id);
              return (
                <article
                  key={e.id}
                  className={`relative rounded-xl border bg-surface p-4 transition-colors duration-150 ${isSel ? "border-accent/50 bg-accent-soft" : "border-border hover:border-border-strong"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    {canManage ? (
                      <input type="checkbox" aria-label={`Select ${e.name}`} checked={isSel} onChange={() => toggle(e.id)} className={checkbox} />
                    ) : (
                      <span />
                    )}
                    {rowMenu(e)}
                  </div>
                  <div className="mt-1 flex flex-col items-center text-center">
                    <div className="grid h-14 w-14 place-items-center rounded-full border border-accent/30 bg-accent-soft text-headline-sm text-accent-hover">{initialsOf(e.name)}</div>
                    <p className="mt-3 flex items-center gap-1.5 text-headline-sm text-ink">
                      {e.name}
                      {e.id === myEmployeeId && <span className="rounded border border-accent/30 bg-accent-soft px-1 text-[10px] text-accent-hover">You</span>}
                    </p>
                    <p className="text-body-sm text-ink-muted">{e.role}</p>
                    <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                      <span className="rounded-md border border-border bg-surface-2 px-2 py-0.5 text-label-sm text-ink-muted">{e.department}</span>
                      <StatusBadge status={e.status} />
                    </div>
                  </div>
                  <div className="mt-4 space-y-1.5 border-t border-border pt-3 text-body-sm">
                    <p className="flex items-center gap-2 truncate text-ink-faint">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{e.email}</span>
                    </p>
                    <p className="flex items-center gap-2 text-ink-faint">
                      <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                      <span className="tnum">
                        Joined {formatDate(e.startedAt)} · {tenure(e.startedAt, today)}
                      </span>
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
          {visible.length === 0 && (
            <div className="rounded-xl border border-border bg-surface">
              <EmptyState hasEmployees={employees.length > 0} canManage={canManage} />
            </div>
          )}
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <Pager current={current} pages={pages} pageSize={pageSize} total={filtered.length} shown={visible.length} onPage={setPage} onSize={(n) => { setPageSize(n); resetPage(); }} />
          </div>
        </section>
      )}

      <EmployeeFormModal open={modalOpen} editing={editing} departments={departments} onClose={() => setModalOpen(false)} onSave={handleSave} />
    </div>
  );
}

function EmptyState({ hasEmployees, canManage }: { hasEmployees: boolean; canManage: boolean }) {
  return (
    <div className="grid place-items-center py-16 text-center">
      <div>
        <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface-2">
          <Users className="h-5 w-5 text-ink-faint" />
        </div>
        <p className="mt-3 text-headline-sm text-ink">{hasEmployees ? "No matching employees" : "No employees yet"}</p>
        <p className="mt-1 text-body-md text-ink-muted">
          {hasEmployees ? "Try a different search or filter." : canManage ? "Click “Add employee” to add your first person." : "Check back later."}
        </p>
      </div>
    </div>
  );
}

function Pager({
  current,
  pages,
  pageSize,
  total,
  shown,
  onPage,
  onSize,
}: {
  current: number;
  pages: number;
  pageSize: number;
  total: number;
  shown: number;
  onPage: (n: number) => void;
  onSize: (n: number) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-5 py-3 text-body-sm text-ink-faint first:border-t-0 sm:flex-row">
      <div className="flex items-center gap-3">
        <span className="tnum">
          Showing {total ? `${current * pageSize + 1}–${current * pageSize + shown}` : 0} of {total} employees
        </span>
        <label className="flex items-center gap-2">
          Rows per page
          <select value={pageSize} onChange={(e) => onSize(Number(e.target.value))} className="h-7 rounded-md border border-border bg-surface-2 px-1.5 text-label-sm text-ink outline-none">
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button disabled={current === 0} onClick={() => onPage(current - 1)} className="rounded-md border border-border px-2.5 py-1 text-label-sm text-ink-muted transition-colors hover:border-border-strong hover:text-ink disabled:opacity-40">
          Previous
        </button>
        <span className="tnum text-label-sm text-ink">
          Page {current + 1} of {pages}
        </span>
        <button disabled={current >= pages - 1} onClick={() => onPage(current + 1)} className="rounded-md border border-border px-2.5 py-1 text-label-sm text-ink-muted transition-colors hover:border-border-strong hover:text-ink disabled:opacity-40">
          Next
        </button>
      </div>
    </div>
  );
}
