"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Download,
  LayoutList,
  LayoutGrid,
  MoreHorizontal,
  X,
  Mail,
  ChevronDown,
  UserX,
  UserRound,
} from "lucide-react";
import { employeeStatuses, type Employee, type EmployeeStatus } from "@/lib/sample-data";
import {
  createEmployee,
  updateEmployee,
  deleteEmployee,
  bulkSetDepartment,
  bulkSetStatus,
  bulkDeleteEmployees,
  type EmployeeInput,
} from "@/lib/employee-actions";
import StatusBadge from "./StatusBadge";
import EmployeeAvatar from "./EmployeeAvatar";
import EmployeeFormModal from "./EmployeeFormModal";
import { deptTint } from "@/lib/dept-tint";
import { formatDate, formatMonthYear, parseDay, tenure } from "./employee-format";

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
  const [view, setView] = useState<"grid" | "table">("grid"); // "People" cards first, like the mockup
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(12);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Headline numbers (all counted from the real list) ─────────────
  const count = (s: EmployeeStatus) => employees.filter((e) => e.status === s).length;
  const t = parseDay(today);
  const monthPrefix = today.slice(0, 7);
  const lastMonth = new Date(t.getFullYear(), t.getMonth() - 1, 1);
  const lastMonthPrefix = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;
  const newThisMonth = employees.filter((e) => e.startedAt.startsWith(monthPrefix)).length;
  const newLastMonth = employees.filter((e) => e.startedAt.startsWith(lastMonthPrefix)).length;
  const deptCount = new Set(employees.map((e) => e.departmentId).filter(Boolean)).size;
  const unassigned = employees.filter((e) => !e.departmentId).length;

  const strip = [
    { label: "Active", value: count("Active"), dot: "bg-good" },
    { label: "On leave", value: count("On Leave"), dot: "bg-warning" },
    { label: "Remote", value: count("Remote"), dot: "bg-sky-300" },
    {
      label: "New this month",
      value: newThisMonth,
      dot: "bg-accent",
      note: newThisMonth !== newLastMonth ? `${newThisMonth > newLastMonth ? "+" : "−"}${Math.abs(newThisMonth - newLastMonth)} vs last month` : `Same as last month`,
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
  const hasFilters = q !== "" || dept !== "All" || status !== "All";
  function resetFilters() {
    setQuery("");
    setDept("All");
    setStatus("All");
    resetPage();
  }

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

  // Build a CSV file in the browser and download it.
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

  const checkbox = "h-4 w-4 cursor-pointer rounded border-border-strong accent-(--color-ink)";
  const bulkOpen = canManage && selectedIds.length > 0;

  // "⋯" menu shared by table rows and grid cards.
  function rowMenu(e: Employee) {
    if (!canManage) return null;
    return (
      <div className="relative">
        <button
          onClick={() => setMenuFor(menuFor === e.id ? null : e.id)}
          aria-label={`Options for ${e.name}`}
          aria-expanded={menuFor === e.id}
          className="grid h-8 w-8 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuFor === e.id && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
            <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-border bg-surface p-1 text-left shadow-popover">
              <Link href={`/employees/${e.id}`} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-label-md text-ink-muted transition-colors hover:bg-bg hover:text-ink">
                <UserRound className="h-3.5 w-3.5" /> View profile
              </Link>
              <button onClick={() => openEdit(e)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-label-md text-ink-muted transition-colors hover:bg-bg hover:text-ink">
                <Pencil className="h-3.5 w-3.5" /> Edit details
              </button>
              <a href={`mailto:${e.email}`} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-label-md text-ink-muted transition-colors hover:bg-bg hover:text-ink">
                <Mail className="h-3.5 w-3.5" /> Send email
              </a>
              <div className="my-1 border-t border-border" />
              <button onClick={() => handleDelete(e)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-label-md text-critical transition-colors hover:bg-critical/10">
                <Trash2 className="h-3.5 w-3.5" /> Remove employee
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Small "You" tag for your own record.
  const youTag = (e: Employee) =>
    e.id === myEmployeeId && <span className="rounded-full bg-accent px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.06em] text-on-accent">You</span>;

  return (
    <div className={`space-y-6 ${bulkOpen ? "pb-28" : ""}`}>
      {/* ── Editorial header ── */}
      <section className="flex flex-col justify-between gap-5 border-b border-border pb-6 md:flex-row md:items-end">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
            <span>Directory index</span>
            <span className="h-1.5 w-1.5 rounded-full bg-ink/30" />
            <span>{isPending ? "Saving…" : `${filtered.length} shown`}</span>
          </div>
          <h1 className="text-headline-lg text-ink md:text-headline-xl">
            {employees.length} {employees.length === 1 ? "person" : "people"} across {deptCount} {deptCount === 1 ? "department" : "departments"}
          </h1>
          <p className="max-w-2xl text-body-md text-ink-muted">
            The full team directory: roles, departments, status and start dates.
            {unassigned > 0 && ` ${unassigned} ${unassigned === 1 ? "person isn't" : "people aren't"} assigned to a department yet.`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            onClick={() => exportCsv(filtered, "employees")}
            disabled={filtered.length === 0}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-5 text-label-md text-ink transition-colors hover:bg-bg disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export directory
          </button>
          {canManage && (
            <button
              onClick={openAdd}
              disabled={isPending}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-5 text-label-md text-on-accent transition-colors hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Add employee
            </button>
          )}
        </div>
      </section>

      {/* ── Status strip: real head-counts, hairline separated ── */}
      <section className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-surface lg:grid-cols-4">
        {strip.map((s, i) => (
          <div key={s.label} className={`p-4 ${i % 2 ? "border-l border-border" : ""} ${i >= 2 ? "border-t border-border lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}>
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
              {s.label}
            </p>
            <p className="tnum mt-1 text-metric-md text-ink">{s.value}</p>
            {s.note && <p className="text-body-sm text-ink-faint">{s.note}</p>}
          </div>
        ))}
      </section>

      {/* ── Filter & view bar ── */}
      <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-3">
          <div className="relative w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                resetPage();
              }}
              placeholder="Search by name, role or email…"
              aria-label="Search employees"
              className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-4 text-body-sm text-ink placeholder:text-ink-muted outline-none transition-colors focus:border-ink focus:ring-1 focus:ring-ink"
            />
          </div>
          <FilterSelect label="Department" value={dept} onChange={(v) => { setDept(v); resetPage(); }}>
            <option value="All">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
            <option value="Unassigned">Unassigned</option>
          </FilterSelect>
          <FilterSelect label="Status" value={status} onChange={(v) => { setStatus(v); resetPage(); }}>
            <option value="All">All</option>
            {employeeStatuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Sort" value={sort} onChange={(v) => setSort(v as SortKey)}>
            {Object.entries(SORTS).map(([k, s]) => (
              <option key={k} value={k}>
                {s.label}
              </option>
            ))}
          </FilterSelect>
        </div>
        <div className="flex shrink-0 items-center justify-between gap-4">
          <span className="tnum text-body-sm text-ink-muted">
            Showing {visible.length} of {filtered.length}
          </span>
          <div className="inline-flex rounded-full border border-border bg-surface p-0.5" role="group" aria-label="View">
            {(["grid", "table"] as const).map((v) => {
              const Icon = v === "grid" ? LayoutGrid : LayoutList;
              return (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-label-md transition-colors ${view === v ? "bg-navy text-on-navy" : "text-ink-muted hover:text-ink"}`}
                >
                  <Icon className="h-4 w-4" />
                  {v === "grid" ? "People" : "Table"}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {view === "table" ? (
        /* ── Table view ── */
        <section className="overflow-hidden rounded-xl border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="border-b border-border bg-bg text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  {canManage && (
                    <th className="w-12 px-4 py-3">
                      <input type="checkbox" aria-label="Select all on this page" checked={allVisibleSelected} onChange={toggleVisible} className={checkbox} />
                    </th>
                  )}
                  <th className="px-4 py-3">Name &amp; contact</th>
                  <th className="hidden px-4 py-3 md:table-cell">Role</th>
                  <th className="hidden px-4 py-3 lg:table-cell">Department</th>
                  <th className="hidden px-4 py-3 sm:table-cell">Start date</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="hidden px-4 py-3 text-right xl:table-cell">Leave / yr</th>
                  <th className="w-12 px-4 py-3 text-right">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => {
                  const isSel = selected.has(e.id);
                  return (
                    <tr key={e.id} className={`border-b border-border last:border-0 ${isSel ? "bg-accent-soft" : "hover:bg-bg"}`}>
                      {canManage && (
                        <td className="px-4 py-3">
                          <input type="checkbox" aria-label={`Select ${e.name}`} checked={isSel} onChange={() => toggle(e.id)} className={checkbox} />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <EmployeeAvatar name={e.name} department={e.departmentId ? e.department : null} size="sm" />
                          <div className="min-w-0">
                            <p className="flex items-center gap-1.5 truncate">
                              <Link href={`/employees/${e.id}`} className="font-semibold text-ink underline-offset-2 hover:underline">
                                {e.name}
                              </Link>
                              {youTag(e)}
                            </p>
                            <p className="truncate text-ink-muted">{e.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 text-body-md text-ink md:table-cell">{e.role}</td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        <DeptLabel name={e.departmentId ? e.department : null} />
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <p className="tnum text-ink-muted">{formatDate(e.startedAt)}</p>
                        <p className="text-ink-faint">{tenure(e.startedAt, today)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={e.status} />
                      </td>
                      <td className="tnum hidden px-4 py-3 text-right text-ink-muted xl:table-cell">{e.leaveAllowance} days</td>
                      <td className="px-4 py-3 text-right">{rowMenu(e)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visible.length === 0 && <EmptyState hasEmployees={employees.length > 0} hasFilters={hasFilters} canManage={canManage} total={employees.length} onReset={resetFilters} />}
          </div>
          <Pager current={current} pages={pages} pageSize={pageSize} total={filtered.length} shown={visible.length} onPage={setPage} onSize={(n) => { setPageSize(n); resetPage(); }} />
        </section>
      ) : (
        /* ── People (card grid) view ── */
        <section className="space-y-4">
          {canManage && visible.length > 0 && (
            <label className="inline-flex cursor-pointer items-center gap-2 text-body-sm text-ink-muted">
              <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} className={checkbox} />
              Select all on this page
            </label>
          )}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {visible.map((e) => {
              const isSel = selected.has(e.id);
              return (
                <article
                  key={e.id}
                  className={`flex flex-col rounded-xl border bg-surface transition-colors duration-150 ${isSel ? "border-ink" : "border-border hover:border-ink/40"}`}
                >
                  {/* Portrait area: big initials avatar on a quiet band (no photos stored) */}
                  <div className="relative grid h-36 place-items-center rounded-t-xl bg-bg">
                    <EmployeeAvatar name={e.name} department={e.departmentId ? e.department : null} size="lg" />
                    <div className="absolute left-3 top-3">
                      {canManage && (
                        <input type="checkbox" aria-label={`Select ${e.name}`} checked={isSel} onChange={() => toggle(e.id)} className={checkbox} />
                      )}
                    </div>
                    <div className="absolute right-2 top-2">{rowMenu(e)}</div>
                  </div>
                  <div className="flex-1 p-5">
                    <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                      <span className={`h-2 w-2 rounded-full ring-1 ring-inset ring-ink/10 ${deptTint(e.departmentId ? e.department : null)}`} />
                      <span className="truncate">{e.departmentId ? e.department : "Unassigned"}</span>
                    </p>
                    <h3 className="flex items-center gap-1.5 text-headline-sm text-ink">
                      <Link href={`/employees/${e.id}`} className="truncate underline-offset-2 hover:underline">
                        {e.name}
                      </Link>
                      {youTag(e)}
                    </h3>
                    <p className="mt-0.5 line-clamp-1 text-body-md text-ink-muted">{e.role}</p>
                    <p className="mt-3 flex items-center gap-1.5 text-body-sm text-ink-muted">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{e.email}</span>
                    </p>
                  </div>
                  <div className="flex items-center justify-between rounded-b-xl border-t border-border bg-bg px-5 py-3">
                    <StatusBadge status={e.status} />
                    <span className="tnum text-[12px] text-ink-muted" title={tenure(e.startedAt, today)}>
                      Joined {formatMonthYear(e.startedAt)}
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
          {visible.length === 0 && (
            <div className="rounded-xl border border-border bg-surface">
              <EmptyState hasEmployees={employees.length > 0} hasFilters={hasFilters} canManage={canManage} total={employees.length} onReset={resetFilters} />
            </div>
          )}
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <Pager current={current} pages={pages} pageSize={pageSize} total={filtered.length} shown={visible.length} onPage={setPage} onSize={(n) => { setPageSize(n); resetPage(); }} />
          </div>
        </section>
      )}

      {/* ── Floating bulk action bar (appears when people are selected) ── */}
      {bulkOpen && (
        <div className="fixed inset-x-4 bottom-4 z-30 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-navy-line bg-navy px-5 py-3 text-on-navy shadow-modal sm:inset-x-auto sm:left-1/2 sm:max-w-[calc(100vw-2rem)] sm:-translate-x-1/2 sm:rounded-full">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="tnum whitespace-nowrap text-body-sm font-semibold">
              {selectedIds.length} {selectedIds.length === 1 ? "employee" : "employees"} selected
            </span>
            <button onClick={() => setSelected(new Set())} aria-label="Deselect all" className="grid h-6 w-6 place-items-center rounded-full text-on-navy-muted transition-colors hover:bg-navy-2 hover:text-on-navy">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="hidden h-4 w-px bg-navy-line sm:block" />
          <div className="flex flex-wrap items-center gap-3 text-body-sm text-on-navy-muted">
            <select
              value=""
              onChange={(e) => bulkDept(e.target.value)}
              disabled={isPending}
              aria-label="Change department"
              className="h-8 cursor-pointer rounded-full border border-navy-line bg-navy-2 px-3 text-on-navy outline-none hover:border-on-navy-muted"
            >
              <option value="">Change department…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
              <option value="__none">Unassigned</option>
            </select>
            <select
              value=""
              onChange={(e) => bulkStatus(e.target.value)}
              disabled={isPending}
              aria-label="Change status"
              className="h-8 cursor-pointer rounded-full border border-navy-line bg-navy-2 px-3 text-on-navy outline-none hover:border-on-navy-muted"
            >
              <option value="">Change status…</option>
              {employeeStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button onClick={bulkDelete} disabled={isPending} className="inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-on-navy-muted transition-colors hover:text-on-navy disabled:opacity-50">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
          <span className="hidden h-4 w-px bg-navy-line sm:block" />
          <button
            onClick={() => exportCsv(employees.filter((e) => selected.has(e.id)), "employees-selected")}
            className="inline-flex h-8 items-center gap-1.5 rounded-full bg-accent px-4 text-label-md text-on-accent transition-colors hover:bg-accent-hover"
          >
            <Download className="h-3.5 w-3.5" /> Export ({selectedIds.length})
          </button>
        </div>
      )}

      <EmployeeFormModal open={modalOpen} editing={editing} departments={departments} onClose={() => setModalOpen(false)} onSave={handleSave} />
    </div>
  );
}

// A hairline-underlined "Label: value ▾" dropdown, as in the mockup's filter bar.
function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="group inline-flex items-center gap-1.5 border-b border-ink/30 pb-1 transition-colors hover:border-ink">
      <span className="text-body-sm text-ink-muted">{label}:</span>
      <span className="relative inline-flex items-center">
        <select value={value} onChange={(e) => onChange(e.target.value)} className="cursor-pointer appearance-none bg-transparent pr-5 text-label-md text-ink outline-none">
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-0 h-4 w-4 text-ink-muted group-hover:text-ink" />
      </span>
    </label>
  );
}

// "● Engineering" — a tint dot + the department name.
function DeptLabel({ name }: { name: string | null }) {
  if (!name) return <span className="text-ink-faint">Unassigned</span>;
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-ink">
      <span className={`h-2 w-2 rounded-full ring-1 ring-inset ring-ink/10 ${deptTint(name)}`} />
      {name}
    </span>
  );
}

function EmptyState({
  hasEmployees,
  hasFilters,
  canManage,
  total,
  onReset,
}: {
  hasEmployees: boolean;
  hasFilters: boolean;
  canManage: boolean;
  total: number;
  onReset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md px-6 py-16 text-center">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-border bg-bg text-ink">
        <UserX className="h-5 w-5" />
      </div>
      <p className="text-headline-sm text-ink">{hasEmployees ? "No teammates found" : "No employees yet"}</p>
      <p className="mt-2 text-body-md text-ink-muted">
        {hasEmployees
          ? `Nobody matches these filters. Clear them to see all ${total} people.`
          : canManage
            ? "Click “Add employee” to add your first person."
            : "Check back later."}
      </p>
      {hasEmployees && hasFilters && (
        <button onClick={onReset} className="mt-5 text-label-md text-ink underline underline-offset-4 hover:opacity-80">
          Reset all filters
        </button>
      )}
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
    <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-5 py-3 text-body-sm text-ink-muted first:border-t-0 sm:flex-row">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <span className="tnum">
          Showing {total ? `${current * pageSize + 1}–${current * pageSize + shown}` : 0} of {total} employees
        </span>
        <label className="flex items-center gap-2">
          Per page
          <select value={pageSize} onChange={(e) => onSize(Number(e.target.value))} className="h-8 rounded-full border border-border bg-surface px-2 text-label-sm text-ink outline-none">
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2">
        <button disabled={current === 0} onClick={() => onPage(current - 1)} className="h-8 rounded-full border border-border bg-surface px-3 text-label-sm text-ink transition-colors hover:bg-bg disabled:opacity-40">
          Previous
        </button>
        <span className="tnum px-1 text-label-sm text-ink">
          {current + 1} / {pages}
        </span>
        <button disabled={current >= pages - 1} onClick={() => onPage(current + 1)} className="h-8 rounded-full border border-border bg-surface px-3 text-label-sm text-ink transition-colors hover:bg-bg disabled:opacity-40">
          Next
        </button>
      </div>
    </div>
  );
}
