"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Employee } from "@/lib/sample-data";
import { updateEmployee, deleteEmployee, type EmployeeInput } from "@/lib/employee-actions";
import EmployeeFormModal from "./EmployeeFormModal";
import ConfirmSheet, { type Confirmation } from "./ConfirmSheet";
import type { DeptOption } from "./EmployeesManager";
import BottomSheet from "@/components/ui/BottomSheet";
import { buttonClass } from "@/components/ui/button";

/*
  The buttons in the profile's navy header: "Email" for everyone, plus
  "Edit profile" and "Remove" for Admin/HR. The server actions re-check the
  permission, so hiding the buttons is only a convenience.

  Phones: the buttons fill the hero's width (Message and Edit share it,
  the bin is a square 48px button). From lg up they shrink to compact pills.

  variant="tiles" is the phone/tablet hero from the mobile mockup: square-ish
  tiles with the icon above the word (Message · Edit in yellow · More). The
  rarely-used, destructive "Remove" hides behind "More" so it can't be hit by accident.
*/
export default function ProfileActions({
  employee,
  departments,
  canManage,
  variant = "bar",
}: {
  employee: Employee;
  departments: DeptOption[];
  canManage: boolean;
  variant?: "bar" | "tiles";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirmation | null>(null);
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
    setConfirm({
      title: `Remove ${employee.name}?`,
      message: "Their leave, attendance, reviews and payslips are deleted too. This can't be undone.",
      confirmLabel: "Remove employee",
      danger: true,
      onConfirm: () =>
        startTransition(async () => {
          try {
            await deleteEmployee(employee.id);
            router.push("/employees"); // the profile no longer exists — back to the directory
          } catch (err) {
            window.alert(err instanceof Error ? err.message : "Something went wrong.");
          }
        }),
    });
  }

  const sheets = (
    <>
      <EmployeeFormModal open={open} editing={employee} departments={departments} onClose={() => setOpen(false)} onSave={handleSave} />
      <ConfirmSheet confirmation={confirm} onClose={() => setConfirm(null)} />
    </>
  );

  if (variant === "tiles") {
    const tile = "flex min-h-16 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-label-md transition-colors disabled:opacity-60";
    return (
      <div className="flex w-full gap-2">
        {employee.email && (
          <a href={`mailto:${employee.email}`} className={`${tile} bg-navy-2 text-on-navy hover:bg-navy-line`}>
            <Mail className="h-5 w-5" aria-hidden />
            Message
          </a>
        )}
        {canManage && (
          <>
            <button onClick={() => setOpen(true)} disabled={isPending} className={`${tile} bg-accent text-on-accent hover:bg-accent-hover`}>
              <Pencil className="h-5 w-5" aria-hidden />
              Edit
            </button>
            <button onClick={() => setMoreOpen(true)} disabled={isPending} aria-haspopup="dialog" className={`${tile} flex-none basis-16 bg-navy-2 text-on-navy hover:bg-navy-line`}>
              <MoreHorizontal className="h-5 w-5" aria-hidden />
              More
            </button>
            <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title={`More for ${employee.name.split(" ")[0]}`}>
              <button
                onClick={() => {
                  setMoreOpen(false);
                  handleDelete();
                }}
                className={buttonClass("danger", { block: true })}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Remove employee
              </button>
            </BottomSheet>
          </>
        )}
        {sheets}
      </div>
    );
  }

  const pill = "inline-flex min-h-tap flex-1 items-center justify-center gap-2 rounded-full px-5 text-label-md transition-colors lg:min-h-10 lg:flex-none";

  return (
    <div className="flex w-full items-center gap-2 lg:w-auto">
      <a href={`mailto:${employee.email}`} className={`${pill} bg-accent text-on-accent hover:bg-accent-hover`}>
        <Mail className="h-4 w-4" aria-hidden />
        Message
      </a>
      {canManage && (
        <>
          <button
            onClick={() => setOpen(true)}
            disabled={isPending}
            className={`${pill} border border-navy-line text-on-navy hover:bg-navy-2 disabled:opacity-60`}
          >
            <Pencil className="h-4 w-4" aria-hidden />
            Edit profile
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            aria-label={`Remove ${employee.name}`}
            className="grid size-tap shrink-0 place-items-center rounded-full border border-navy-line text-on-navy-muted transition-colors hover:bg-navy-2 hover:text-on-navy disabled:opacity-60 lg:size-10"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </>
      )}
      {sheets}
    </div>
  );
}
