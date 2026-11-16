"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Trash2, Download, X, Link2, KeyRound, Eye, EyeOff, CheckCircle2, UserRound, Check, Minus } from "lucide-react";
import { initialsOf } from "@/lib/sample-data";
import {
  ROLES,
  canManageEmployees,
  canManageDepartments,
  canManageLeave,
  canManageAttendance,
  canManageReviews,
  canManageRecruitment,
  canManagePayroll,
  canManageUsers,
} from "@/lib/permissions";
import { deptTint } from "@/lib/dept-tint";
import { createUser, updateUser, deleteUser, type UserRow, type UserInput } from "@/lib/user-actions";

type EmployeeOption = { id: string; name: string; title: string; department: string | null };

// What each role can do — shown on the role picker so admins choose knowingly.
const ROLE_INFO: Record<string, string> = {
  Admin: "Everything, including user accounts and role assignment",
  HR: "Employees, departments, payroll, leave, attendance, reviews and recruiting",
  Manager: "Approve leave, view attendance, write reviews and run recruiting",
  Employee: "Self-service: own leave, attendance, payslips and reviews",
};
// Little coloured dot shown before each role name in the table.
const ROLE_DOT: Record<string, string> = {
  Admin: "bg-ink",
  HR: "bg-accent",
  Manager: "bg-tint-sky border border-border-strong",
  Employee: "bg-surface-2 border border-border-strong",
};

/*
  The access matrix. Each row asks the SAME permission functions the server
  uses to enforce rules, so the ticks can never disagree with reality.
*/
const MATRIX: { label: string; detail: string; can: (role: string) => boolean }[] = [
  { label: "Manage employees", detail: "Add, edit and remove employee records", can: canManageEmployees },
  { label: "Manage departments", detail: "Create, rename and delete departments", can: canManageDepartments },
  { label: "Approve leave", detail: "Approve or reject everyone's time off", can: canManageLeave },
  { label: "View all attendance", detail: "See and correct everyone's clock-ins", can: canManageAttendance },
  { label: "Write performance reviews", detail: "Create, share and edit reviews", can: canManageReviews },
  { label: "Recruitment", detail: "Post jobs and manage candidates", can: canManageRecruitment },
  { label: "Payroll", detail: "Set salaries and run pay cycles", can: canManagePayroll },
  { label: "Manage user accounts", detail: "Create logins and assign roles", can: canManageUsers },
];

const PAGE_SIZES = [10, 25, 50];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const capsLabel = "text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted";

// Round initials avatar, tinted by the linked employee's department.
function Avatar({ name, department, size = "h-9 w-9 text-[11px]" }: { name: string; department: string | null; size?: string }) {
  return (
    <div className={`grid shrink-0 place-items-center rounded-full font-semibold text-ink ${size} ${deptTint(department)}`}>
      {name ? initialsOf(name) : <UserRound className="h-5 w-5" />}
    </div>
  );
}

// The inspector's editable copy of a user ("new" = adding an account).
type Draft = { id: string | "new"; name: string; email: string; role: string; employeeId: string; password: string };

export default function UsersManager({
  users,
  employees,
  currentUserId,
  now,
}: {
  users: UserRow[];
  employees: EmployeeOption[];
  currentUserId: string; // so we can mark & protect "your" account
  now: string; // ISO time from the server (keeps server & browser in agreement)
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Headline numbers ──────────────────────────────────────────────
  const linked = users.filter((u) => u.employeeId).length;
  const linkedIds = new Set(users.map((u) => u.employeeId).filter(Boolean));
  const withoutLogin = employees.filter((e) => !linkedIds.has(e.id)).length;
  const byRole = (r: string) => users.filter((u) => u.role === r).length;
  const monthAgo = new Date(now).getTime() - 30 * 86_400_000;
  const newThisMonth = users.filter((u) => new Date(u.createdAt).getTime() >= monthAgo).length;

  // Look up a user's department (via their linked employee) for the avatar tint.
  const deptOf = (employeeId: string | null) => employees.find((e) => e.id === employeeId)?.department ?? null;

  // ── Filter + page ─────────────────────────────────────────────────
  const q = query.trim().toLowerCase();
  const filtered = users
    .filter((u) => roleFilter === "all" || u.role === roleFilter)
    .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.employeeName ?? "").toLowerCase().includes(q));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * pageSize, current * pageSize + pageSize);

  // ── Drawer (edit / add) ───────────────────────────────────────────
  const editingUser = draft && draft.id !== "new" ? users.find((u) => u.id === draft.id) ?? null : null;
  const isSelf = draft?.id === currentUserId;
  // Employees offered in the link dropdown: unlinked ones + whoever this user already has.
  const linkOptions = employees.filter((e) => !linkedIds.has(e.id) || e.id === editingUser?.employeeId);
  const linkedEmp = employees.find((e) => e.id === draft?.employeeId) ?? null;

  function open(u: UserRow) {
    setMsg(null);
    setShowPw(false);
    setDraft({ id: u.id, name: u.name, email: u.email, role: u.role, employeeId: u.employeeId ?? "", password: "" });
  }
  function openNew() {
    setMsg(null);
    setShowPw(false);
    setDraft({ id: "new", name: "", email: "", role: "Employee", employeeId: "", password: "" });
  }
  const set = (patch: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  function save() {
    if (!draft) return;
    setMsg(null);
    if (!draft.name.trim() || !draft.email.trim()) return setMsg({ ok: false, text: "Name and email are required." });
    if (draft.id === "new" && draft.password.length < 8) return setMsg({ ok: false, text: "Set a starting password of at least 8 characters." });
    if (draft.id !== "new" && draft.password && draft.password.length < 8) return setMsg({ ok: false, text: "A new password must be at least 8 characters." });

    const input: UserInput = {
      name: draft.name.trim(),
      email: draft.email.trim(),
      role: draft.role,
      employeeId: draft.employeeId || null,
      password: draft.password || undefined, // blank on edit = keep current password
    };
    startTransition(async () => {
      try {
        const saved = draft.id === "new" ? await createUser(input) : await updateUser(draft.id, input);
        router.refresh();
        setDraft({ id: saved.id, name: saved.name, email: saved.email, role: saved.role, employeeId: saved.employeeId ?? "", password: "" });
        setMsg({ ok: true, text: draft.id === "new" ? "Account created. Share the starting password with them securely." : "Changes saved." });
      } catch (err) {
        setMsg({ ok: false, text: err instanceof Error ? err.message : "Could not save the account." });
      }
    });
  }

  function remove() {
    if (!editingUser || !window.confirm(`Delete ${editingUser.name}'s login? They won't be able to sign in. Their employee record is kept.`)) return;
    startTransition(async () => {
      try {
        await deleteUser(editingUser.id);
        setDraft(null);
        router.refresh();
      } catch (err) {
        setMsg({ ok: false, text: err instanceof Error ? err.message : "Could not delete the account." });
      }
    });
  }

  function exportCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const rows = [["Name", "Email", "Role", "Linked employee", "Created"], ...users.map((u) => [u.name, u.email, u.role, u.employeeName ?? "", u.createdAt.slice(0, 10)])];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "user-accounts.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const input =
    "h-11 w-full rounded-lg border border-border bg-surface px-3 text-body-md text-ink placeholder:text-ink-faint outline-none transition-colors hover:border-border-strong focus:border-ink focus:ring-1 focus:ring-ink";
  const label = `mb-1.5 block ${capsLabel}`;

  return (
    <div className="space-y-8">
      {/* ── Editorial header ── */}
      <section className="space-y-4 border-b border-border pb-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="space-y-2">
            <p className={capsLabel}>System · Access &amp; permissions</p>
            <h1 className="text-headline-lg text-ink md:text-headline-xl">Who can sign in.</h1>
            <p className="max-w-2xl text-body-md text-ink-muted">
              {isPending ? "Working…" : "Manage login accounts, assign roles, and link each login to an employee record."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={exportCsv}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-label-md text-ink transition-colors hover:bg-bg"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              onClick={openNew}
              disabled={isPending}
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-accent px-5 text-label-md font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Add account
            </button>
          </div>
        </div>

        {/* One-line summary strip (all real counts) */}
        <p className="tnum flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-ink-muted">
          <span className="font-semibold text-ink">
            {users.length} account{users.length === 1 ? "" : "s"}
          </span>
          <span className="text-ink-faint">·</span>
          <span>{linked} linked to employees</span>
          <span className="text-ink-faint">·</span>
          <span>{withoutLogin} employee{withoutLogin === 1 ? "" : "s"} without a login</span>
          <span className="text-ink-faint">·</span>
          <span>
            {byRole("Admin")} admin{byRole("Admin") === 1 ? "" : "s"}
          </span>
          {newThisMonth > 0 && (
            <>
              <span className="text-ink-faint">·</span>
              <span className="text-accent-ink">+{newThisMonth} in the last 30 days</span>
            </>
          )}
        </p>
      </section>

      {/* ── Tabs (jump links) + search + role filter ── */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <nav className="flex gap-6 border-b border-border">
            <a href="#accounts" className="-mb-px border-b-2 border-ink pb-2.5 text-label-md font-semibold text-ink">
              Accounts <span className="tnum">({users.length})</span>
            </a>
            <a href="#access-matrix" className="-mb-px border-b-2 border-transparent pb-2.5 text-label-md text-ink-muted transition-colors hover:text-ink">
              Roles &amp; permissions
            </a>
          </nav>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative sm:w-80">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder="Search accounts by name or email…"
                className="h-10 w-full rounded-full border border-border bg-surface pl-10 pr-4 text-body-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-ink focus:ring-1 focus:ring-ink"
              />
            </div>
            <select
              aria-label="Role"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(0);
              }}
              className="h-10 rounded-full border border-border bg-surface px-4 text-label-md text-ink outline-none transition-colors hover:border-border-strong focus:border-ink focus:ring-1 focus:ring-ink"
            >
              <option value="all">All roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r} ({byRole(r)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Accounts table ── */}
        <div id="accounts" className="scroll-mt-6 overflow-hidden rounded-xl border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-body-sm">
              <thead>
                <tr className="border-b border-border bg-bg text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                  <th className="px-5 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="hidden px-4 py-3 md:table-cell">Linked employee</th>
                  <th className="hidden px-5 py-3 lg:table-cell">Created</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => {
                  const selected = draft?.id === u.id;
                  return (
                    <tr
                      key={u.id}
                      onClick={() => open(u)}
                      className={`cursor-pointer border-b border-border last:border-0 ${selected ? "bg-surface-2" : "hover:bg-bg"}`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} department={deptOf(u.employeeId)} />
                          <div className="min-w-0">
                            <p className="flex items-center gap-2 truncate font-semibold text-ink">
                              {u.name}
                              {u.id === currentUserId && (
                                <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">You</span>
                              )}
                            </p>
                            <p className="truncate text-ink-muted">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-2 text-ink">
                          <span className={`h-2 w-2 rounded-full ${ROLE_DOT[u.role] ?? ROLE_DOT.Employee}`} />
                          {u.role}
                        </span>
                      </td>
                      <td className="hidden px-4 py-3.5 md:table-cell">
                        {u.employeeName ? (
                          <span className="flex items-center gap-1.5 text-ink">
                            <Link2 className="h-3.5 w-3.5 text-ink-muted" />
                            {u.employeeName}
                          </span>
                        ) : (
                          <span className="text-ink-faint">Not linked</span>
                        )}
                      </td>
                      <td className="tnum hidden px-5 py-3.5 text-ink-muted lg:table-cell">{formatDate(u.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visible.length === 0 && <p className="py-12 text-center text-body-md text-ink-muted">No accounts match.</p>}
          </div>

          {/* Footer: count, page size, pager */}
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-5 py-3 text-body-sm text-ink-muted sm:flex-row">
            <div className="flex items-center gap-3">
              <span className="tnum">
                Showing {filtered.length ? `${current * pageSize + 1}–${current * pageSize + visible.length}` : 0} of {filtered.length} accounts
              </span>
              <label className="flex items-center gap-2">
                Rows
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(0);
                  }}
                  className="h-7 rounded-full border border-border bg-surface px-2 text-label-sm text-ink outline-none"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button disabled={current === 0} onClick={() => setPage(current - 1)} className="h-8 rounded-full border border-border bg-surface px-3 text-label-sm text-ink transition-colors hover:bg-bg disabled:opacity-40">
                Previous
              </button>
              <span className="tnum text-label-sm text-ink">
                {current + 1} / {pages}
              </span>
              <button disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="h-8 rounded-full border border-border bg-surface px-3 text-label-sm text-ink transition-colors hover:bg-bg disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── System access matrix ── */}
      <section id="access-matrix" className="scroll-mt-6 rounded-xl border border-border bg-surface p-5 sm:p-8">
        <h2 className="text-headline-md text-ink">System access matrix</h2>
        <p className="mt-1 text-body-md text-ink-muted">What each role can do. Everyone can always manage their own leave, attendance and payslips.</p>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-body-sm">
            <thead>
              <tr className={`border-b border-border ${capsLabel}`}>
                <th className="py-3 pr-4">Permission scope</th>
                {ROLES.map((r) => (
                  <th key={r} className="px-3 py-3 text-center">
                    {r}
                    <span className="tnum ml-1 font-normal normal-case tracking-normal text-ink-faint">({byRole(r)})</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((m) => (
                <tr key={m.label} className="border-b border-border last:border-0">
                  <td className="py-3.5 pr-4">
                    <p className="font-semibold text-ink">{m.label}</p>
                    <p className="text-ink-muted">{m.detail}</p>
                  </td>
                  {ROLES.map((r) => (
                    <td key={r} className="px-3 py-3.5 text-center">
                      {m.can(r) ? (
                        <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-navy text-on-navy" aria-label="Allowed">
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <span className="inline-grid h-6 w-6 place-items-center text-ink-faint" aria-label="No access">
                          <Minus className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Account drawer (slides over from the right) ── */}
      {draft && (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label={draft.id === "new" ? "Add account" : "Edit account"}
          // Escape closes the drawer.
          onKeyDown={(e) => e.key === "Escape" && setDraft(null)}
        >
          {/* Scrim — clicking it closes the drawer */}
          <button aria-label="Close" tabIndex={-1} onClick={() => setDraft(null)} className="absolute inset-0 bg-navy/45" />

          <aside className="relative flex h-full w-full max-w-[520px] flex-col border-l border-border bg-bg shadow-modal">
            <header className="flex items-start justify-between gap-3 border-b border-border px-6 py-5">
              <div>
                <p className={capsLabel}>Account drawer</p>
                <h2 className="mt-1 text-headline-sm text-ink">{draft.id === "new" ? "Add a new account" : "Edit account permissions"}</h2>
              </div>
              <button
                onClick={() => setDraft(null)}
                aria-label="Close"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border bg-surface text-ink-muted transition-colors hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 space-y-7 overflow-y-auto px-6 py-6">
              {/* Identity card */}
              <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4">
                <Avatar name={draft.name} department={linkedEmp?.department ?? null} size="h-12 w-12 text-body-md" />
                <div className="min-w-0">
                  <p className="truncate text-label-md font-semibold text-ink">{draft.id === "new" ? "New account" : draft.name || "Unnamed"}</p>
                  <p className="truncate text-body-sm text-ink-muted">
                    {draft.id === "new" ? "They'll sign in with this email and password" : draft.email}
                  </p>
                  {editingUser && <p className="tnum text-body-sm text-ink-faint">Created {formatDate(editingUser.createdAt)}</p>}
                </div>
              </div>

              {/* Name + email */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="u-name" className={label}>
                    Full name
                  </label>
                  <input id="u-name" className={input} value={draft.name} onChange={(e) => set({ name: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="u-email" className={label}>
                    Sign-in email
                  </label>
                  <input id="u-email" type="email" className={input} value={draft.email} onChange={(e) => set({ email: e.target.value })} />
                </div>
              </div>

              {/* Role picker */}
              <fieldset>
                <legend className={`mb-3 ${capsLabel}`}>Assign system role</legend>
                <div className="space-y-2.5">
                  {ROLES.map((r) => {
                    const checked = draft.role === r;
                    // Server rule: you can't remove your OWN Admin role (no lock-out).
                    const locked = isSelf && r !== "Admin";
                    return (
                      <label
                        key={r}
                        className={[
                          "flex cursor-pointer items-start gap-3 rounded-xl border bg-surface p-4 transition-colors",
                          checked ? "border-ink ring-1 ring-ink" : "border-border hover:border-border-strong",
                          locked ? "cursor-not-allowed opacity-50" : "",
                        ].join(" ")}
                      >
                        <input
                          type="radio"
                          name="role"
                          value={r}
                          checked={checked}
                          disabled={locked}
                          onChange={() => set({ role: r })}
                          className="mt-0.5 h-4 w-4 accent-(--color-ink)"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2 text-label-md font-semibold text-ink">
                            {r}
                            {editingUser?.role === r && <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Current</span>}
                          </span>
                          <span className="block text-body-sm text-ink-muted">{ROLE_INFO[r]}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {isSelf && <p className="mt-2 text-body-sm text-ink-muted">You can&apos;t remove your own Admin role, so you can&apos;t lock yourself out.</p>}
              </fieldset>

              {/* Linked employee */}
              <div className="border-t border-border pt-6">
                <label htmlFor="u-emp" className={label}>
                  Linked employee profile
                </label>
                <select id="u-emp" className={input} value={draft.employeeId} onChange={(e) => set({ employeeId: e.target.value })}>
                  <option value="">Not linked</option>
                  {linkOptions.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
                {linkedEmp ? (
                  <div className="mt-2 flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
                    <Avatar name={linkedEmp.name} department={linkedEmp.department} size="h-8 w-8 text-[10px]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-label-md text-ink">{linkedEmp.name}</p>
                      <p className="truncate text-body-sm text-ink-muted">
                        {linkedEmp.title}
                        {linkedEmp.department ? ` · ${linkedEmp.department}` : ""}
                      </p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-good" />
                  </div>
                ) : (
                  <p className="mt-2 text-body-sm text-ink-muted">Link a profile so they can see their own leave, attendance, payslips and reviews.</p>
                )}
              </div>

              {/* Password */}
              <div className="border-t border-border pt-6">
                <label htmlFor="u-pw" className={label}>
                  {draft.id === "new" ? "Starting password" : "Reset password"}
                </label>
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                  <input
                    id="u-pw"
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
                    className={`${input} pl-9 pr-10`}
                    value={draft.password}
                    onChange={(e) => set({ password: e.target.value })}
                    placeholder={draft.id === "new" ? "At least 8 characters" : "Leave blank to keep their current password"}
                  />
                  <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-ink-faint hover:text-ink">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {msg && (
                <p role={msg.ok ? "status" : "alert"} className={`rounded-lg border px-3 py-2 text-body-sm ${msg.ok ? "border-good/30 bg-good/10 text-good" : "border-critical/40 bg-critical/10 text-critical"}`}>
                  {msg.text}
                </p>
              )}
            </div>

            <footer className="flex items-center justify-between gap-2 border-t border-border bg-surface px-6 py-4">
              {editingUser && !isSelf ? (
                <button onClick={remove} disabled={isPending} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-label-md text-critical transition-colors hover:bg-critical/10 disabled:opacity-50">
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button onClick={() => setDraft(null)} className="h-10 rounded-full border border-border bg-surface px-5 text-label-md text-ink transition-colors hover:bg-bg">
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={isPending}
                  className="h-10 rounded-full bg-navy px-5 text-label-md font-semibold text-on-navy transition-colors hover:bg-navy-2 disabled:opacity-60"
                >
                  {isPending ? "Saving…" : draft.id === "new" ? "Create account" : "Save changes"}
                </button>
              </div>
            </footer>
          </aside>
        </div>
      )}
    </div>
  );
}
