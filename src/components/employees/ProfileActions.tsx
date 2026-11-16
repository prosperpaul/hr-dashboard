"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Pencil, Trash2 } from "lucide-react";
import type { Employee } from "@/lib/sample-data";
import { updateEmployee, deleteEmployee, type EmployeeInput } from "@/lib/employee-actions";
import EmployeeFormModal from "./EmployeeFormModal";
import type { DeptOption } from "./EmployeesManager";

/*
  The buttons in the profile's navy header: "Email" for everyone, plus
  "Edit profile" and "Remove" for Admin/HR. The server actions re-check the
  permission, so hiding the buttons is only a convenience.
*/
export default function ProfileActions({
  employee,
  departments,
  canManage,
}: {
  employee: Employee;
  departments: DeptOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave(data: EmployeeInput, id?: string) {
    if (!id) return;
    startTransition(async () => {
      try {
        await updateEmployee(id, data);
        setOpen(false);
        router.refresh(); // reload the profile with the new details
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Something went wrong. That email may already be in use.");
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`Remove ${employee.name}? Their leave, attendance, reviews and payslips are deleted too. This can't be undone.`)) return;
    startTransition(async () => {
      try {
        await deleteEmployee(employee.id);
        router.push("/employees"); // the profile no longer exists — back to the directory
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={`mailto:${employee.email}`}
        className="inline-flex h-10 items-center gap-2 rounded-full bg-accent px-5 text-label-md text-on-accent transition-colors hover:bg-accent-hover"
      >
        <Mail className="h-4 w-4" />
        Message
      </a>
      {canManage && (
        <>
          <button
            onClick={() => setOpen(true)}
            disabled={isPending}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-navy-line px-5 text-label-md text-on-navy transition-colors hover:bg-navy-2 disabled:opacity-60"
          >
            <Pencil className="h-4 w-4" />
            Edit profile
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            aria-label={`Remove ${employee.name}`}
            className="grid h-10 w-10 place-items-center rounded-full border border-navy-line text-on-navy-muted transition-colors hover:bg-navy-2 hover:text-on-navy disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      )}
      <EmployeeFormModal open={open} editing={employee} departments={departments} onClose={() => setOpen(false)} onSave={handleSave} />
    </div>
  );
}
