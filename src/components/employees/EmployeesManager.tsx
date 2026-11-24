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
import StatusBadge, { EmployeeStatusText } from "./StatusBadge";
import EmployeeAvatar from "./EmployeeAvatar";
import EmployeeFormModal from "./EmployeeFormModal";
import { deptTint } from "@/lib/dept-tint";
import { formatDate, formatMonthYear, parseDay, tenure } from "./employee-format";
import FilterBar from "@/components/ui/FilterBar";
import ListRow from "@/components/ui/ListRow";
import Fab from "@/components/ui/Fab";
import ConfirmSheet, { type Confirmation } from "./ConfirmSheet";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form";

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
  initialQuery = "",
  focusSearch = false,
}: {
  employees: Employee[];
  departments: DeptOption[];
  // Admin/HR may add/edit/delete. The server actions enforce the same rule
  // again, so hiding buttons is purely for convenience.
  canManage: boolean;
  myEmployeeId: string | null; // your own record, tagged "You"
  today: string; // business-time-zone date from the server
  initialQuery?: string; // ?q=… from the top-bar search
  focusSearch?: boolean; // ?search=1 — the phone search button opens with the box focused
}) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
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
  const [created, setCreated] = useState<Employee | null>(null); // just-added employee (success screen)
  const [confirm, setConfirm] = useState<Confirmation | null>(null);
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
    .filter(
      (e) =>
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q), // so "engineering" finds that team
    )
    .filter((e) => dept === "All" || e.department === dept)
    .filter((e) => status === "All" || e.status === status)
    .sort(SORTS[sort].fn);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * pageSize, current * pageSize + pageSize);
  const resetPage = () => setPage(0);
  const hasFilters = q !== "" || dept !== "All" || status !== "All";

  /*
    Phones & tablets show the WHOLE filtered list (no pages — you just
    scroll), grouped under letter headers when sorted by name (A, B, C…).
    Any other sort order is one plain group, since letters would be jumbled.
  */
  const groups: { letter: string | null; people: Employee[] }[] = [];
  for (const e of filtered) {
    const first = e.name.trim().charAt(0).toUpperCase();
    const letter = sort === "name" ? (/[A-Z]/.test(first) ? first : "#") : null;
    const last = groups[groups.length - 1];
    if (last && last.letter === letter) last.people.push(e);
    else groups.push({ letter, people: [e] });
  }
  function resetFilters() {
    setQuery("");
    setDept("All");
    setStatus("All");
    resetPage();
  }
  // The phone filter sheet's "Reset" leaves the search box alone (it's outside the sheet).
  const sheetFilterCount = (dept !== "All" ? 1 : 0) + (status !== "All" ? 1 : 0) + (sort !== "name" ? 1 : 0);
  function resetSheetFilters() {
    setDept("All");
    setStatus("All");
    setSort("name");
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
  // `after` receives whatever the action returned (e.g. the new employee).
  function run<T>(fn: () => Promise<T>, after?: (result: T) => void) {
    startTransition(async () => {
      try {
        const result = await fn();
        after?.(result);
        router.refresh(); // reload fresh data so every number stays correct
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Something went wrong. That email may already be in use.");
      }
    });
  }
  function openAdd() {
    setEditing(null);
    setCreated(null);
    setModalOpen(true);
  }
  function openEdit(e: Employee) {
    setMenuFor(null);
    setEditing(e);
    setCreated(null);
    setModalOpen(true);
  }
  // Editing: save and close. Creating: keep the sheet open and swap it to
  // the "Welcome to the team" success screen for the new person.
  const handleSave = (data: EmployeeInput, id?: string) =>
    id
      ? run(() => updateEmployee(id, data), () => setModalOpen(false))
      : run(() => createEmployee(data), (emp) => setCreated(emp));
  function handleDelete(e: Employee) {
    setMenuFor(null);
    setConfirm({
      title: `Remove ${e.name}?`,
      message: "Their leave, attendance, reviews and payslips are deleted too. This can't be undone.",
      confirmLabel: "Remove employee",
      danger: true,
      onConfirm: () => run(() => deleteEmployee(e.id)),
    });
  }
  function bulkDept(value: string) {
    if (!value) return;
    const target = value === "__none" ? null : value;
    const name = target ? departments.find((d) => d.id === target)?.name : "Unassigned";
    const who = `${selectedIds.length} ${selectedIds.length === 1 ? "person" : "people"}`;
    const ids = selectedIds;
    setConfirm({
      title: "Change department?",
      message: `Move ${who} to ${name}?`,
      confirmLabel: "Move",
      onConfirm: () => run(() => bulkSetDepartment(ids, target)),
    });
  }
  function bulkStatus(value: string) {
    if (!value) return;
    const who = `${selectedIds.length} ${selectedIds.length === 1 ? "person" : "people"}`;
    const ids = selectedIds;
    setConfirm({
      title: "Change status?",
      message: `Set ${who} to "${value}"?`,
      confirmLabel: "Change status",
      onConfirm: () => run(() => bulkSetStatus(ids, value as EmployeeStatus)),
    });
  }
  function bulkDelete() {
    const ids = selectedIds;
    setConfirm({
      title: `Delete ${ids.length} employees?`,
      message: "All their leave, attendance, reviews and payslips are deleted too. This can't be undone.",
      confirmLabel: "Delete",
      danger: true,
      onConfirm: () => run(() => bulkDeleteEmployees(ids), () => setSelected(new Set())),
    });
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

  const bulkOpen = canManage && selectedIds.length > 0;

  const menuItem = "flex min-h-tap w-full items-center gap-2 rounded-lg px-2.5 py-2 text-label-md transition-colors lg:min-h-0";

  // "⋯" menu shared by table rows and grid cards (tablet/desktop only).
  function rowMenu(e: Employee) {
    if (!canManage) return null;
    return (
      <div className="relative">
        <button
          onClick={() => setMenuFor(menuFor === e.id ? null : e.id)}
          aria-label={`Options for ${e.name}`}
          aria-expanded={menuFor === e.id}
          // The ::before stretches the 32px button's tap area to 48px below lg.
          className="relative grid h-8 w-8 place-items-center rounded-full text-ink-muted transition-colors before:absolute before:-inset-2 before:content-[''] hover:bg-surface-2 hover:text-ink lg:before:hidden"
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden />
        </button>
        {menuFor === e.id && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
            <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-border bg-surface p-1 text-left shadow-popover">
              <Link href={`/employees/${e.id}`} className={`${menuItem} text-ink-muted hover:bg-bg hover:text-ink`}>
                <UserRound className="h-3.5 w-3.5" aria-hidden /> View profile
              </Link>
              <button onClick={() => openEdit(e)} className={`${menuItem} text-ink-muted hover:bg-bg hover:text-ink`}>
                <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit details
              </button>
              <a href={`mailto:${e.email}`} className={`${menuItem} text-ink-muted hover:bg-bg hover:text-ink`}>
                <Mail className="h-3.5 w-3.5" aria-hidden /> Send email
              </a>
              <div className="my-1 border-t border-border" />
              <button onClick={() => handleDelete(e)} className={`${menuItem} text-critical hover:bg-critical/10`}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove employee
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Small "You" tag for your own record.
  const youTag = (e: Employee) =>
    e.id === myEmployeeId && <span className="shrink-0 rounded-full bg-accent px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.06em] text-on-accent">You</span>;

  const empty = <EmptyState hasEmployees={employees.length > 0} hasFilters={hasFilters} canManage={canManage} total={employees.length} onReset={resetFilters} />;
  const pager = (
    <Pager current={current} pages={pages} pageSize={pageSize} total={filtered.length} shown={visible.length} onPage={setPage} onSize={(n) => { setPageSize(n); resetPage(); }} />
  );

  return (
    <div className={`space-y-4 lg:space-y-6 ${bulkOpen ? "lg:pb-28" : ""}`}>
      {/* ── Phones & tablets: the mockup's simple "People" title. Adding someone
          lives in the floating yellow button (Fab) at the bottom instead. ── */}
      <header className="flex items-start justify-between gap-3 lg:hidden">
        <div className="min-w-0">
          <h1 className="font-display text-headline-lg text-ink">People</h1>
          <p className="tnum text-body-md text-ink-muted" aria-live="polite">
            {isPending
              ? "Saving…"
              : `${employees.length} across ${deptCount} ${deptCount === 1 ? "department" : "departments"}`}
          </p>
        </div>
        <button
          onClick={() => exportCsv(filtered, "employees")}
          disabled={filtered.length === 0}
          aria-label="Export directory as CSV"
          className={buttonClass("ghost", { icon: true })}
        >
          <Download className="h-5 w-5" aria-hidden />
        </button>
      </header>

      {/* ── Desktop: editorial header ── */}
      <section className="hidden flex-col justify-between gap-5 border-b border-border pb-6 lg:flex lg:flex-row lg:items-end">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-eyebrow uppercase text-ink-muted">
            <span>Directory index</span>
            <span className="h-1.5 w-1.5 rounded-full bg-ink/30" aria-hidden />
            <span>{isPending ? "Saving…" : `${filtered.length} shown`}</span>
          </div>
          <h1 className="text-headline-lg text-ink wrap-anywhere md:text-headline-xl">
            {employees.length} {employees.length === 1 ? "person" : "people"} across {deptCount} {deptCount === 1 ? "department" : "departments"}
          </h1>
          <p className="max-w-2xl text-body-md text-ink-muted">
            The full team directory: roles, departments, status and start dates.
            {unassigned > 0 && ` ${unassigned} ${unassigned === 1 ? "person isn't" : "people aren't"} assigned to a department yet.`}
          </p>
        </div>
        {/* Phones: the two buttons share the row equally (Add first, it's the main job). */}
        <div className="flex shrink-0 flex-row-reverse items-center gap-2 md:flex-row md:flex-wrap">
          <button
            onClick={() => exportCsv(filtered, "employees")}
            disabled={filtered.length === 0}
            className={`${buttonClass("secondary")} flex-1 md:flex-none`}
          >
            <Download className="h-4 w-4" aria-hidden />
            <span className="md:hidden">Export</span>
            <span className="hidden md:inline">Export directory</span>
          </button>
          {canManage && (
            <button onClick={openAdd} disabled={isPending} className={`${buttonClass("primary")} flex-1 md:flex-none`}>
              <Plus className="h-4 w-4" aria-hidden />
              Add employee
            </button>
          )}
        </div>
      </section>

      {/* ── Status strip: real head-counts, hairline separated ── */}
      <section aria-label="Head-counts" className="hidden grid-cols-2 overflow-hidden rounded-xl border border-border bg-surface lg:grid lg:grid-cols-4">
        {strip.map((s, i) => (
          <div key={s.label} className={`min-w-0 p-4 ${i % 2 ? "border-l border-border" : ""} ${i >= 2 ? "border-t border-border lg:border-t-0" : ""} ${i === 2 ? "lg:border-l" : ""}`}>
            <p className="flex items-center gap-1.5 text-eyebrow uppercase text-ink-muted">
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} aria-hidden />
              <span className="truncate">{s.label}</span>
            </p>
            <p className="tnum mt-1 text-metric-md text-ink">{s.value}</p>
            {s.note && <p className="text-body-sm text-ink-faint">{s.note}</p>}
          </div>
        ))}
      </section>

      {/* ── Filter & view bar ── */}
      <section aria-label="Filters" className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <FilterBar
          className="flex-1 md:gap-x-6"
          activeCount={sheetFilterCount}
          onReset={resetSheetFilters}
          search={
            <div className="relative w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 lg:left-3 -translate-y-1/2 text-ink-muted" aria-hidden />
              <input
                type="search"
                autoComplete="off"
                enterKeyHint="search"
                autoFocus={focusSearch}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  resetPage();
                }}
                placeholder="Search name, role, email or team…"
                aria-label="Search employees"
                // A sunken, fully rounded "search pill" on phones/tablets; the boxy field on desktop.
                className={inputClass.replace("rounded-lg", "rounded-full lg:rounded-lg").replace("px-3.5", "pl-10 pr-4 lg:pl-9").replace("lg:min-h-11", "lg:min-h-10")}
              />
            </div>
          }
        >
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
        </FilterBar>
        <div className="hidden shrink-0 items-center justify-between gap-4 lg:flex">
          <span className="tnum text-body-sm text-ink-muted" aria-live="polite">
            Showing {visible.length} of {filtered.length}
          </span>
          {/* People/Table only makes sense with room for cards or columns, so phones & tablets get one list. */}
          <div className="inline-flex rounded-full border border-border bg-surface p-0.5" role="group" aria-label="View">
            {(["grid", "table"] as const).map((v) => {
              const Icon = v === "grid" ? LayoutGrid : LayoutList;
              return (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`inline-flex min-h-tap items-center gap-1.5 rounded-full px-3.5 py-1.5 text-label-md transition-colors lg:min-h-0 ${view === v ? "bg-navy text-on-navy" : "text-ink-muted hover:text-ink"}`}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {v === "grid" ? "People" : "Table"}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Phones & tablets: the active filters as removable chips ── */}
      {(dept !== "All" || status !== "All") && (
        <div className="flex flex-wrap items-center gap-2 lg:hidden">
          {dept !== "All" && <FilterChip label={dept} onRemove={() => { setDept("All"); resetPage(); }} />}
          {status !== "All" && <FilterChip label={status} onRemove={() => { setStatus("All"); resetPage(); }} />}
          <button onClick={resetFilters} className="inline-flex min-h-tap items-center px-2 text-label-md text-ink-muted underline underline-offset-4 hover:text-ink">
            Clear all
          </button>
        </div>
      )}

      {/* ── Phones & tablets: three small head-count cards (real numbers) ── */}
      <section aria-label="Head-counts" className="grid grid-cols-3 gap-2 lg:hidden">
        {strip.slice(0, 3).map((s) => (
          <div key={s.label} className="min-w-0 rounded-xl border border-border bg-surface p-3">
            <p className="truncate text-eyebrow uppercase text-ink-muted">{s.label}</p>
            <p className={`tnum mt-1 text-metric-md ${s.label === "On leave" ? "text-accent-ink" : "text-ink"}`}>{s.value}</p>
          </div>
        ))}
      </section>

      {/* ── Phones & tablets: the A–Z directory. Each row opens the profile,
          where edit / remove live, so there's no per-row menu or bulk select here.
          Extra bottom padding keeps the last row clear of the floating Add button. ── */}
      <section aria-label="Employees" className={`lg:hidden ${canManage ? "pb-20" : ""}`}>
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface">{empty}</div>
        ) : (
          <div className="space-y-5">
            {groups.map((g, gi) => (
              <div key={g.letter ?? `all-${gi}`}>
                {g.letter && (
                  // The letter, then a hairline rule running to the edge.
                  <h2 className="mb-2 flex items-center gap-3 font-display text-headline-sm text-ink">
                    {g.letter}
                    <span className="h-px flex-1 bg-border" aria-hidden />
                  </h2>
                )}
                <ul className="divide-y divide-border rounded-xl border border-border bg-surface px-4">
                  {g.people.map((e) => (
                    <li key={e.id} className="min-w-0">
                      <ListRow
                        href={`/employees/${e.id}`}
                        label={`${e.name}, ${e.role}, ${e.departmentId ? e.department : "Unassigned"}, ${e.status}`}
                        leading={<EmployeeAvatar name={e.name} department={e.departmentId ? e.department : null} size="sm" />}
                        title={
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate">{e.name}</span>
                            {youTag(e)}
                          </span>
                        }
                        subtitle={e.role}
                        trailing={<EmployeeStatusText status={e.status} variant="pill" />}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {canManage && <Fab label="Add employee" icon={<Plus className="h-5 w-5" />} onClick={openAdd} />}

      {/* ── Desktop: People cards or the full table ── */}
      <div className="hidden lg:block">
        {view === "table" ? (
          /* ── Table view ── */
          <section aria-label="Employees" className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-body-sm">
                <caption className="sr-only">Employees</caption>
                <thead>
                  <tr className="border-b border-border bg-bg text-eyebrow uppercase text-ink-muted">
                    {canManage && (
                      <th className="w-12 px-4 py-3">
                        <Check label="Select all on this page" checked={allVisibleSelected} onChange={toggleVisible} />
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
                            <Check label={`Select ${e.name}`} checked={isSel} onChange={() => toggle(e.id)} />
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
              {visible.length === 0 && empty}
            </div>
            {pager}
          </section>
        ) : (
          /* ── People (card grid) view ── */
          <section aria-label="Employees" className="space-y-4">
            {canManage && visible.length > 0 && (
              <label className="inline-flex min-h-tap cursor-pointer items-center gap-2 text-body-sm text-ink-muted lg:min-h-0">
                <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} className="h-4 w-4 cursor-pointer rounded border-border-strong accent-(--color-ink)" />
                Select all on this page
              </label>
            )}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {visible.map((e) => {
                const isSel = selected.has(e.id);
                return (
                  <article
                    key={e.id}
                    className={`flex min-w-0 flex-col rounded-xl border bg-surface transition-colors duration-150 ${isSel ? "border-ink" : "border-border hover:border-ink/40"}`}
                  >
                    {/* Portrait area: big initials avatar on a quiet band (no photos stored) */}
                    <div className="relative grid h-36 place-items-center rounded-t-xl bg-bg">
                      <EmployeeAvatar name={e.name} department={e.departmentId ? e.department : null} size="lg" />
                      <div className="absolute left-3 top-3">
                        {canManage && <Check label={`Select ${e.name}`} checked={isSel} onChange={() => toggle(e.id)} />}
                      </div>
                      <div className="absolute right-2 top-2">{rowMenu(e)}</div>
                    </div>
                    <div className="min-w-0 flex-1 p-5">
                      <p className="mb-1.5 flex items-center gap-1.5 text-eyebrow uppercase text-ink-muted">
                        <span className={`h-2 w-2 shrink-0 rounded-full ring-1 ring-inset ring-ink/10 ${deptTint(e.departmentId ? e.department : null)}`} aria-hidden />
                        <span className="truncate">{e.departmentId ? e.department : "Unassigned"}</span>
                      </p>
                      <h3 className="flex min-w-0 items-center gap-1.5 text-headline-sm text-ink">
                        <Link href={`/employees/${e.id}`} className="truncate underline-offset-2 hover:underline">
                          {e.name}
                        </Link>
                        {youTag(e)}
                      </h3>
                      <p className="mt-0.5 line-clamp-1 text-body-md text-ink-muted">{e.role}</p>
                      <p className="mt-3 flex items-center gap-1.5 text-body-sm text-ink-muted">
                        <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
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
            {visible.length === 0 && <div className="rounded-xl border border-border bg-surface">{empty}</div>}
            <div className="overflow-hidden rounded-xl border border-border bg-surface">{pager}</div>
          </section>
        )}
      </div>

      {/* ── Floating bulk action bar (appears when people are selected).
          Selecting only exists on desktop, so the bar does too. ── */}
      {bulkOpen && (
        <div className="fixed inset-x-4 bottom-4 z-30 hidden flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-navy-line bg-navy px-5 py-3 text-on-navy shadow-modal lg:inset-x-auto lg:left-1/2 lg:flex lg:max-w-[calc(100vw-2rem)] lg:-translate-x-1/2 lg:rounded-full">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
            <span className="tnum whitespace-nowrap text-body-sm font-semibold">
              {selectedIds.length} {selectedIds.length === 1 ? "employee" : "employees"} selected
            </span>
            <button
              onClick={() => setSelected(new Set())}
              aria-label="Deselect all"
              className="relative grid h-6 w-6 place-items-center rounded-full text-on-navy-muted transition-colors before:absolute before:-inset-3 before:content-[''] hover:bg-navy-2 hover:text-on-navy lg:before:hidden"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <span className="hidden h-4 w-px bg-navy-line sm:block" />
          <div className="flex flex-wrap items-center gap-3 text-body-sm text-on-navy-muted">
            <select
              value=""
              onChange={(e) => bulkDept(e.target.value)}
              disabled={isPending}
              aria-label="Change department"
              className="min-h-tap cursor-pointer rounded-full border border-navy-line bg-navy-2 px-3 text-on-navy outline-none hover:border-on-navy-muted lg:h-8 lg:min-h-0"
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
              className="min-h-tap cursor-pointer rounded-full border border-navy-line bg-navy-2 px-3 text-on-navy outline-none hover:border-on-navy-muted lg:h-8 lg:min-h-0"
            >
              <option value="">Change status…</option>
              {employeeStatuses.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button onClick={bulkDelete} disabled={isPending} className="inline-flex min-h-tap items-center gap-1.5 rounded-full px-2 text-on-navy-muted transition-colors hover:text-on-navy disabled:opacity-50 lg:h-8 lg:min-h-0">
              <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
            </button>
          </div>
          <span className="hidden h-4 w-px bg-navy-line sm:block" />
          <button
            onClick={() => exportCsv(employees.filter((e) => selected.has(e.id)), "employees-selected")}
            className="inline-flex min-h-tap items-center gap-1.5 rounded-full bg-accent px-4 text-label-md text-on-accent transition-colors hover:bg-accent-hover lg:h-8 lg:min-h-0"
          >
            <Download className="h-3.5 w-3.5" aria-hidden /> Export ({selectedIds.length})
          </button>
        </div>
      )}

      <EmployeeFormModal
        open={modalOpen}
        editing={editing}
        created={created}
        departments={departments}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onAddAnother={() => setCreated(null)}
      />
      <ConfirmSheet confirmation={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

// A checkbox inside an invisible 48px hit area (the label's ::before),
// so it's easy to tap on tablets without changing the table layout.
// From lg up (mouse) the hit area is just the box itself.
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="relative inline-grid cursor-pointer place-items-center before:absolute before:-inset-4 before:content-[''] lg:before:hidden">
      <input type="checkbox" aria-label={label} checked={checked} onChange={onChange} className="relative h-4 w-4 cursor-pointer rounded border-border-strong accent-(--color-ink)" />
    </label>
  );
}


/*
  One filter dropdown. It's rendered twice by FilterBar:
  • inside the phone filter sheet → base classes: label above a full-size 48px select;
  • inline on md+ → md: classes: the hairline-underlined "Label: value ▾" from the mockup.
*/
function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="group flex flex-col gap-1.5 md:inline-flex md:flex-row md:items-center md:border-b md:border-ink/30 md:pb-1 md:transition-colors md:hover:border-ink">
      <span className="text-label-md text-ink md:text-body-sm md:text-ink-muted">
        {label}
        <span className="hidden md:inline">:</span>
      </span>
      <span className="relative flex items-center md:inline-flex">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass.replace("lg:min-h-11", "lg:min-h-0")} cursor-pointer md:w-auto md:appearance-none md:rounded-none md:border-0 md:bg-transparent md:pl-0 md:pr-5 md:text-label-md md:hover:border-0 md:focus:ring-0`}
        >
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-0 hidden h-4 w-4 text-ink-muted group-hover:text-ink md:block" aria-hidden />
      </span>
    </label>
  );
}

// An active filter as a soft pill with an ✕ to remove it (phones & tablets).
// The visible pill is 36px but the button's tap area is the full 48px.
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button onClick={onRemove} aria-label={`Remove filter: ${label}`} className="group flex min-h-tap max-w-full items-center">
      <span className="inline-flex h-9 min-w-0 items-center gap-1.5 rounded-full bg-tint-lilac pl-3.5 pr-2.5 text-label-md text-ink group-hover:bg-sunken">
        <span className="truncate">{label}</span>
        <X className="h-4 w-4 shrink-0" aria-hidden />
      </span>
    </button>
  );
}

// "● Engineering" — a tint dot + the department name.
function DeptLabel({ name }: { name: string | null }) {
  if (!name) return <span className="text-ink-faint">Unassigned</span>;
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-ink">
      <span className={`h-2 w-2 rounded-full ring-1 ring-inset ring-ink/10 ${deptTint(name)}`} aria-hidden />
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
    <div className="mx-auto max-w-md px-6 py-12 text-center md:py-16">
      <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-border bg-bg text-ink">
        <UserX className="h-5 w-5" aria-hidden />
      </div>
      <p className="text-headline-sm text-ink">{hasEmployees ? "No teammates found" : "No employees yet"}</p>
      <p className="mt-2 text-body-md text-ink-muted">
        {hasEmployees
          ? `Nobody matches these filters. Clear them to see all ${total} people.`
          : canManage
            ? "Tap “Add employee” to add your first person."
            : "Check back later."}
      </p>
      {hasEmployees && hasFilters && (
        <button onClick={onReset} className="mt-3 inline-flex min-h-tap items-center px-2 text-label-md text-ink underline underline-offset-4 hover:opacity-80 lg:min-h-0 md:mt-5">
          Reset all filters
        </button>
      )}
    </div>
  );
}

// Pager buttons: 48px and sharing the row on phones, compact pills from md up.
const pagerButton =
  "inline-flex min-h-tap flex-1 items-center justify-center rounded-full border border-border bg-surface px-4 text-label-sm text-ink transition-colors hover:bg-bg disabled:opacity-40 lg:h-8 lg:min-h-0 md:flex-none md:px-3";

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
    <div className="flex flex-col items-stretch justify-between gap-3 border-t border-border px-4 py-3 text-body-sm text-ink-muted first:border-t-0 sm:flex-row sm:items-center sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-center">
        <span className="tnum">
          Showing {total ? `${current * pageSize + 1}–${current * pageSize + shown}` : 0} of {total} employees
        </span>
        <label className="flex items-center gap-2">
          Per page
          <select
            value={pageSize}
            onChange={(e) => onSize(Number(e.target.value))}
            className="min-h-tap rounded-full border border-border bg-surface px-3 text-label-sm text-ink outline-none lg:h-8 lg:min-h-0 md:px-2"
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
      <nav aria-label="Pages" className="flex items-center gap-2">
        <button disabled={current === 0} onClick={() => onPage(current - 1)} className={pagerButton}>
          Previous
        </button>
        <span className="tnum shrink-0 px-1 text-label-sm text-ink">
          {current + 1} / {pages}
        </span>
        <button disabled={current >= pages - 1} onClick={() => onPage(current + 1)} className={pagerButton}>
          Next
        </button>
      </nav>
    </div>
  );
}
