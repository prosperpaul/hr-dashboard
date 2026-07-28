"use client";

import { useMemo, useState, useTransition } from "react";
import { Search, Plus, Pencil, Trash2, ShieldCheck, Link2 as LinkIcon } from "lucide-react";
import { initialsOf } from "@/lib/sample-data";
import {
  createUser,
  updateUser,
  deleteUser,
  type UserRow,
  type UserInput,
} from "@/lib/user-actions";
import UserFormModal from "./UserFormModal";

// Format an ISO date into "Nov 4, 2024".
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Colour each role differently so they're easy to scan.
function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    Admin: "bg-accent-soft text-accent ring-accent/40",
    HR: "bg-chart-2/15 text-chart-2 ring-chart-2/40",
    Manager: "bg-chart-3/15 text-chart-3 ring-chart-3/40",
    Employee: "bg-surface-2 text-ink-muted ring-border",
  };
  const cls = styles[role] ?? styles.Employee;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cls}`}>
      {role}
    </span>
  );
}

type EmployeeOption = { id: string; name: string };

export default function UsersManager({
  initialUsers,
  employees,
  currentUserId,
}: {
  initialUsers: UserRow[];
  employees: EmployeeOption[]; // for the "link to employee record" dropdown
  currentUserId: string; // so we can mark/protect "your" account in the UI
}) {
  const [list, setList] = useState<UserRow[]>(initialUsers);
  const [query, setQuery] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    );
  }, [list, query]);

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(user: UserRow) {
    setEditing(user);
    setModalOpen(true);
  }

  function handleSave(data: UserInput, id?: string) {
    startTransition(async () => {
      try {
        if (id) {
          const updated = await updateUser(id, data);
          setList((prev) => prev.map((u) => (u.id === id ? updated : u)));
        } else {
          const created = await createUser(data);
          setList((prev) => [created, ...prev]);
        }
        setModalOpen(false);
      } catch (err) {
        // Show the specific reason the server gave (e.g. duplicate email).
        const msg = err instanceof Error ? err.message : "Could not save the account.";
        window.alert(msg);
      }
    });
  }

  function handleDelete(user: UserRow) {
    const ok = window.confirm(`Remove ${user.name}'s account? They will lose access.`);
    if (!ok) return;
    startTransition(async () => {
      try {
        await deleteUser(user.id);
        setList((prev) => prev.filter((u) => u.id !== user.id));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not delete this account.";
        window.alert(msg);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-ink">
            <ShieldCheck className="h-6 w-6 text-accent" />
            User accounts
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {isPending ? "Saving…" : `${list.length} people can sign in`}
          </p>
        </div>
        <button
          onClick={openAdd}
          disabled={isPending}
          className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          Add account
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, or role…"
          className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/40"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-ink-faint">
                <th className="px-4 py-3 font-medium sm:px-5">User</th>
                <th className="px-4 py-3 font-medium sm:px-5">Role</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell sm:px-5">Employee record</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell sm:px-5">Created</th>
                <th className="px-4 py-3 font-medium text-right sm:px-5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const isSelf = u.id === currentUserId;
                return (
                  <tr
                    key={u.id}
                    className="border-b border-border last:border-0 transition-colors hover:bg-surface-2"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-chart-2 text-xs font-semibold text-white">
                          {initialsOf(u.name)}
                        </div>
                        <div className="min-w-0">
                          <p className="flex items-center gap-2 truncate font-medium text-ink">
                            {u.name}
                            {isSelf && (
                              <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-normal text-ink-faint">
                                You
                              </span>
                            )}
                          </p>
                          <p className="truncate text-xs text-ink-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 sm:px-5"><RoleBadge role={u.role} /></td>
                    <td className="hidden px-4 py-3 md:table-cell sm:px-5">
                      {u.employeeName ? (
                        <span className="inline-flex items-center gap-1.5 text-ink-muted">
                          <LinkIcon className="h-3.5 w-3.5 text-ink-faint" />
                          {u.employeeName}
                        </span>
                      ) : (
                        <span className="text-ink-faint">Not linked</span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-ink-muted lg:table-cell sm:px-5">{formatDate(u.createdAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(u)}
                          aria-label={`Edit ${u.name}`}
                          className="grid h-8 w-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface hover:text-accent"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {/* You can't delete your own account — hide the button */}
                        {!isSelf && (
                          <button
                            onClick={() => handleDelete(u)}
                            aria-label={`Delete ${u.name}`}
                            className="grid h-8 w-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface hover:text-critical"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="grid place-items-center py-16 text-center">
            <div>
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-surface-2">
                <ShieldCheck className="h-5 w-5 text-ink-faint" />
              </div>
              <p className="mt-3 text-sm font-medium text-ink">No accounts found</p>
              <p className="mt-1 text-sm text-ink-muted">Try a different search.</p>
            </div>
          </div>
        )}
      </div>

      <UserFormModal
        open={modalOpen}
        editing={editing}
        employees={employees}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
