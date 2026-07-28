"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, Plus, Pencil, Trash2, Users } from "lucide-react";
import {
  employeeStatuses,
  initialsOf,
  type Employee,
} from "@/lib/sample-data";

// A department option for the filter + form dropdown.
export type DeptOption = { id: string; name: string };
import {
  createEmployee,
  updateEmployee,
  deleteEmployee,
  type EmployeeInput,
} from "@/lib/employee-actions";
import StatusBadge from "./StatusBadge";
import EmployeeFormModal from "./EmployeeFormModal";

// Format an ISO date like "2024-11-04" into "Nov 4, 2024".
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function EmployeesManager({
  initialEmployees,
  departments,
  canManage,
}: {
  initialEmployees: Employee[];
  // Real departments from the DB — powers the filter and the form dropdown.
  departments: DeptOption[];
  // Whether the current user (Admin/HR) may add/edit/delete. Decided on the
  // server and passed in — the buttons below respect it. The server actions
  // enforce the same rule again, so hiding buttons is purely for UX.
  canManage: boolean;
}) {
  // The working list of employees (starts from the database).
  const [list, setList] = useState<Employee[]>(initialEmployees);

  // Toolbar filters.
  const [query, setQuery] = useState("");
  const [dept, setDept] = useState("All");
  const [status, setStatus] = useState("All");

  // Modal state: is it open, and are we editing someone (or adding)?
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  // isPending is true while a database save/delete is in progress.
  const [isPending, startTransition] = useTransition();

  // Compute the filtered list. useMemo re-runs this only when inputs change.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((e) => {
      const matchesQuery =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q);
      const matchesDept = dept === "All" || e.department === dept;
      const matchesStatus = status === "All" || e.status === status;
      return matchesQuery && matchesDept && matchesStatus;
    });
  }, [list, query, dept, status]);

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(employee: Employee) {
    setEditing(employee);
    setModalOpen(true);
  }

  // Save handler used by the form for BOTH adding and editing.
  // It calls the server action (which writes to the database), then
  // updates the on-screen list with what the database returned.
  function handleSave(data: EmployeeInput, id?: string) {
    startTransition(async () => {
      try {
        if (id) {
          const updated = await updateEmployee(id, data);
          setList((prev) => prev.map((e) => (e.id === id ? updated : e)));
        } else {
          const created = await createEmployee(data);
          setList((prev) => [created, ...prev]);
        }
        setModalOpen(false);
      } catch {
        // Most likely cause: the email is already used by someone else.
        window.alert("Could not save. That email may already be in use.");
      }
    });
  }

  function handleDelete(employee: Employee) {
    const ok = window.confirm(`Remove ${employee.name}? This can't be undone.`);
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteEmployee(employee.id);
        setList((prev) => prev.filter((e) => e.id !== employee.id));
      } catch {
        window.alert("Could not delete this employee. Please try again.");
      }
    });
  }

  const selectClass =
    "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/40";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Employees</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {isPending ? "Saving…" : `${list.length} people in your organization`}
          </p>
        </div>
        {/* Only Admin/HR see the add button */}
        {canManage && (
          <button
            onClick={openAdd}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Add employee
          </button>
        )}
      </div>

      {/* Toolbar: search + filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or role…"
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/40"
          />
        </div>

        <select className={selectClass} value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="All">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.name}>{d.name}</option>
          ))}
        </select>

        <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="All">All statuses</option>
          {employeeStatuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-ink-faint">
                <th className="px-4 py-3 font-medium sm:px-5">Employee</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell sm:px-5">Role</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell sm:px-5">Department</th>
                <th className="px-4 py-3 font-medium sm:px-5">Status</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell sm:px-5">Start date</th>
                {canManage && <th className="px-4 py-3 font-medium text-right sm:px-5">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-border last:border-0 transition-colors hover:bg-surface-2"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-chart-2 text-xs font-semibold text-white">
                        {initialsOf(e.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{e.name}</p>
                        <p className="truncate text-xs text-ink-muted">{e.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-ink-muted md:table-cell sm:px-5">{e.role}</td>
                  <td className="hidden px-4 py-3 text-ink-muted lg:table-cell sm:px-5">{e.department}</td>
                  <td className="px-4 py-3 sm:px-5"><StatusBadge status={e.status} /></td>
                  <td className="hidden px-4 py-3 text-ink-muted sm:table-cell sm:px-5">{formatDate(e.startedAt)}</td>
                  {canManage && (
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(e)}
                          aria-label={`Edit ${e.name}`}
                          className="grid h-8 w-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface hover:text-accent"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(e)}
                          aria-label={`Delete ${e.name}`}
                          className="grid h-8 w-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface hover:text-critical"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Empty state when no one matches the filters */}
        {filtered.length === 0 && (
          <div className="grid place-items-center py-16 text-center">
            <div>
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-surface-2">
                <Users className="h-5 w-5 text-ink-faint" />
              </div>
              <p className="mt-3 text-sm font-medium text-ink">No employees found</p>
              <p className="mt-1 text-sm text-ink-muted">Try adjusting your search or filters.</p>
            </div>
          </div>
        )}
      </div>

      {/* The add/edit slide-in panel */}
      <EmployeeFormModal
        open={modalOpen}
        editing={editing}
        departments={departments}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
