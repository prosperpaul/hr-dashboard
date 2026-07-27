"use client";

import { useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Building2, Users } from "lucide-react";
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
  type DepartmentRow,
  type DepartmentInput,
} from "@/lib/department-actions";
import DepartmentFormModal from "./DepartmentFormModal";

export default function DepartmentsManager({
  initialDepartments,
  canManage,
}: {
  initialDepartments: DepartmentRow[];
  canManage: boolean;
}) {
  const [list, setList] = useState<DepartmentRow[]>(initialDepartments);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalPeople = list.reduce((sum, d) => sum + d.employeeCount, 0);

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(dept: DepartmentRow) {
    setEditing(dept);
    setModalOpen(true);
  }

  function handleSave(data: DepartmentInput, id?: string) {
    startTransition(async () => {
      try {
        if (id) {
          await updateDepartment(id, data);
          setList((prev) =>
            prev.map((d) =>
              d.id === id ? { ...d, name: data.name, description: data.description || null } : d,
            ),
          );
        } else {
          await createDepartment(data);
          // New department has no employees yet; give it a temporary id until
          // the next full page load (revalidatePath refreshes server data).
          setList((prev) =>
            [
              ...prev,
              {
                id: `temp-${Date.now()}`,
                name: data.name,
                description: data.description || null,
                employeeCount: 0,
              },
            ].sort((a, b) => a.name.localeCompare(b.name)),
          );
        }
        setModalOpen(false);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not save the department.";
        window.alert(msg);
      }
    });
  }

  function handleDelete(dept: DepartmentRow) {
    const warn =
      dept.employeeCount > 0
        ? `${dept.name} has ${dept.employeeCount} employee(s). Deleting it won't remove them, but they'll no longer belong to a listed department. Continue?`
        : `Delete the ${dept.name} department?`;
    if (!window.confirm(warn)) return;
    startTransition(async () => {
      try {
        await deleteDepartment(dept.id);
        setList((prev) => prev.filter((d) => d.id !== dept.id));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not delete this department.";
        window.alert(msg);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Departments</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {isPending
              ? "Saving…"
              : `${list.length} departments · ${totalPeople} people`}
          </p>
        </div>
        {canManage && (
          <button
            onClick={openAdd}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Add department
          </button>
        )}
      </div>

      {/* Card grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((dept) => (
          <div
            key={dept.id}
            className="group flex flex-col rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent/40"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-soft ring-1 ring-accent/30">
                <Building2 className="h-5 w-5 text-accent" />
              </div>

              {canManage && (
                <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    onClick={() => openEdit(dept)}
                    aria-label={`Edit ${dept.name}`}
                    className="grid h-8 w-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface-2 hover:text-accent"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(dept)}
                    aria-label={`Delete ${dept.name}`}
                    className="grid h-8 w-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface-2 hover:text-critical"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <h2 className="mt-4 text-base font-semibold text-ink">{dept.name}</h2>
            <p className="mt-1 flex-1 text-sm text-ink-muted">
              {dept.description || "No description yet."}
            </p>

            <div className="mt-4 flex items-center gap-1.5 border-t border-border pt-3 text-sm text-ink-muted">
              <Users className="h-4 w-4 text-ink-faint" />
              <span className="font-medium text-ink">{dept.employeeCount}</span>
              {dept.employeeCount === 1 ? "employee" : "employees"}
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {list.length === 0 && (
        <div className="grid place-items-center rounded-2xl border border-border bg-surface py-16 text-center">
          <div>
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-surface-2">
              <Building2 className="h-5 w-5 text-ink-faint" />
            </div>
            <p className="mt-3 text-sm font-medium text-ink">No departments yet</p>
            <p className="mt-1 text-sm text-ink-muted">
              {canManage ? "Add your first department to get started." : "Check back later."}
            </p>
          </div>
        </div>
      )}

      <DepartmentFormModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
