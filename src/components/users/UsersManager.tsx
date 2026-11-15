"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Trash2, ShieldCheck, Download, X, Link2, KeyRound, Eye, EyeOff, CheckCircle2, UserRound } from "lucide-react";
import { initialsOf } from "@/lib/sample-data";
import { ROLES } from "@/lib/permissions";
import { createUser, updateUser, deleteUser, type UserRow, type UserInput } from "@/lib/user-actions";
import StatCard, { type DashStat } from "@/components/dashboard/StatCard";

type EmployeeOption = { id: string; name: string; title: string; department: string | null };

// What each role can do — shown on the role picker so admins choose knowingly.
const ROLE_INFO: Record<string, string> = {
  Admin: "Everything, including user accounts and role assignment",
  HR: "Employees, departments, payroll, leave, attendance, reviews and recruiting",
  Manager: "Approve leave, view attendance, write reviews and run recruiting",
  Employee: "Self-service: own leave, attendance, payslips and reviews",
};
const ROLE_PILL: Record<string, string> = {
  Admin: "border-accent/30 bg-accent-soft text-accent-hover",
  HR: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  Manager: "border-violet-400/30 bg-violet-400/10 text-violet-300",
  Employee: "border-border bg-white/[0.04] text-ink-muted",
};
const PAGE_SIZES = [10, 25, 50];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

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

  const stats: DashStat[] = [
    {
      key: "total",
      label: "Total accounts",
      value: String(users.length),
      badge: newThisMonth > 0 ? { text: `+${newThisMonth} in 30d`, trend: "up" } : undefined,
      footer: { label: "Roles in use", value: `${ROLES.filter((r) => byRole(r) > 0).length} of ${ROLES.length}` },
    },
    {
      key: "linked",
      label: "Linked to employees",
      value: String(linked),
      side: <span className="mb-1 mr-auto ml-1.5 text-body-sm text-ink-faint">/ {users.length}</span>,
      bar: [
        { value: linked, className: "bg-accent" },
        { value: users.length - linked, className: "bg-transparent" },
      ],
      footer: { label: "Employees without a login", value: String(withoutLogin), accent: withoutLogin === 0 },
    },
    {
      key: "privileged",
      label: "Privileged access",
      value: String(byRole("Admin") + byRole("HR")),
      badge: { text: `${byRole("Admin")} admin${byRole("Admin") === 1 ? "" : "s"}`, tone: "neutral" },
      footer: { label: "Admins · HR", value: `${byRole("Admin")} · ${byRole("HR")}` },
    },
    {
      key: "team",
      label: "Managers & staff",
      value: String(byRole("Manager") + byRole("Employee")),
      footer: { label: "Managers · Employees", value: `${byRole("Manager")} · ${byRole("Employee")}` },
    },
  ];

  // ── Filter + page ─────────────────────────────────────────────────
  const q = query.trim().toLowerCase();
  const filtered = users
    .filter((u) => roleFilter === "all" || u.role === roleFilter)
    .filter((u) => !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.employeeName ?? "").toLowerCase().includes(q));
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * pageSize, current * pageSize + pageSize);

  // ── Inspector ─────────────────────────────────────────────────────
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
    "h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-body-md text-ink placeholder:text-ink-faint outline-none transition-colors hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent";
  const label = "mb-1.5 block text-label-sm uppercase tracking-wider text-ink-faint";

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-label-sm uppercase tracking-wider text-ink-faint">
            <span>System</span>
            <span>/</span>
            <span className="normal-case tracking-normal text-ink-muted">User accounts</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg border border-accent/25 bg-accent-soft">
              <ShieldCheck className="h-5 w-5 text-accent-hover" />
            </span>
            <h1 className="text-headline-lg text-ink md:text-headline-xl">User accounts</h1>
          </div>
          <p className="max-w-2xl text-body-md text-ink-muted">
            {isPending ? "Working…" : "Who can sign in, what role they have, and which employee record they belong to."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={exportCsv}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 text-label-md text-ink transition-colors hover:border-border-strong hover:bg-white/[0.03]"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            onClick={openNew}
            disabled={isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-label-md font-semibold text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] transition-colors hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            Add account
          </button>
        </div>
      </section>

      {/* ── KPI cards ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.key} stat={s} />
        ))}
      </section>

      <section className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        {/* ── Accounts list ── */}
        <div className={`overflow-hidden rounded-xl border border-border bg-surface ${draft ? "xl:col-span-7" : "xl:col-span-12"}`}>
          <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder="Search name, email or linked employee…"
                className="h-9 w-full rounded-lg border border-border bg-surface-2 pl-8 pr-3 text-body-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </div>
            <select
              aria-label="Role"
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(0);
              }}
              className="h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-label-md text-ink outline-none transition-colors hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent"
            >
              <option value="all">Role: All roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r} ({byRole(r)})
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px] leading-[18px]">
              <thead>
                <tr className="border-b border-border text-label-sm uppercase tracking-[0.05em] text-ink-faint">
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className={`hidden px-4 py-3 font-medium ${draft ? "2xl:table-cell" : "md:table-cell"}`}>Linked employee</th>
                  <th className={`hidden px-5 py-3 font-medium ${draft ? "" : "lg:table-cell"}`}>Created</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => {
                  const selected = draft?.id === u.id;
                  return (
                    <tr
                      key={u.id}
                      onClick={() => open(u)}
                      className={`h-14 cursor-pointer border-b border-border last:border-0 ${selected ? "bg-surface-2" : "hover:bg-surface-2"}`}
                    >
                      <td className={`px-5 py-2.5 ${selected ? "shadow-[inset_2px_0_0_var(--color-accent)]" : ""}`}>
                        <div className="flex items-center gap-2.5">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent-hover">
                            {initialsOf(u.name)}
                          </div>
                          <div className="min-w-0">
                            <p className={`flex items-center gap-1.5 truncate font-medium ${selected ? "text-accent-hover" : "text-ink"}`}>
                              {u.name}
                              {u.id === currentUserId && (
                                <span className="rounded border border-accent/30 bg-accent-soft px-1 text-[10px] text-accent-hover">You</span>
                              )}
                            </p>
                            <p className="truncate text-body-sm text-ink-faint">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-label-sm ${ROLE_PILL[u.role] ?? ROLE_PILL.Employee}`}>{u.role}</span>
                      </td>
                      <td className={`hidden px-4 py-2.5 ${draft ? "2xl:table-cell" : "md:table-cell"}`}>
                        {u.employeeName ? (
                          <span className="flex items-center gap-1.5 text-ink-muted">
                            <Link2 className="h-3.5 w-3.5 text-accent" />
                            {u.employeeName}
                          </span>
                        ) : (
                          <span className="text-ink-faint">Not linked</span>
                        )}
                      </td>
                      <td className={`tnum hidden px-5 py-2.5 text-ink-faint ${draft ? "" : "lg:table-cell"}`}>{formatDate(u.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visible.length === 0 && <p className="py-12 text-center text-body-md text-ink-muted">No accounts match.</p>}
          </div>

          <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-5 py-3 text-body-sm text-ink-faint sm:flex-row">
            <div className="flex items-center gap-3">
              <span className="tnum">
                {filtered.length ? `${current * pageSize + 1}–${current * pageSize + visible.length}` : 0} of {filtered.length}
              </span>
              <label className="flex items-center gap-2">
                Rows
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(0);
                  }}
                  className="h-7 rounded-md border border-border bg-surface-2 px-1.5 text-label-sm text-ink outline-none"
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
              <button disabled={current === 0} onClick={() => setPage(current - 1)} className="rounded-md border border-border px-2.5 py-1 text-label-sm text-ink-muted transition-colors hover:border-border-strong hover:text-ink disabled:opacity-40">
                Previous
              </button>
              <span className="tnum text-label-sm text-ink">
                {current + 1} / {pages}
              </span>
              <button disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="rounded-md border border-border px-2.5 py-1 text-label-sm text-ink-muted transition-colors hover:border-border-strong hover:text-ink disabled:opacity-40">
                Next
              </button>
            </div>
          </div>
        </div>

        {/* ── Inspector ── */}
        {draft && (
          <aside className="overflow-hidden rounded-xl border border-border bg-surface xl:sticky xl:top-4 xl:col-span-5">
            <div className="flex items-start justify-between gap-3 border-b border-border p-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-accent/30 bg-accent-soft text-headline-sm text-accent-hover">
                  {draft.name ? initialsOf(draft.name) : <UserRound className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-headline-md text-ink">{draft.id === "new" ? "New account" : draft.name || "Unnamed"}</p>
                  <p className="truncate text-body-sm text-ink-faint">
                    {draft.id === "new" ? "They'll sign in with this email and password" : `Created ${editingUser ? formatDate(editingUser.createdAt) : ""}`}
                  </p>
                </div>
              </div>
              <button onClick={() => setDraft(null)} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6 p-5">
              {/* Identity */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
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
                <legend className={label}>Assigned role</legend>
                <div className="space-y-2">
                  {ROLES.map((r) => {
                    const checked = draft.role === r;
                    // Server rule: you can't remove your OWN Admin role (no lock-out).
                    const locked = isSelf && r !== "Admin";
                    return (
                      <label
                        key={r}
                        className={[
                          "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                          checked ? "border-accent/50 bg-accent-soft" : "border-border bg-surface-2 hover:border-border-strong",
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
                          className="mt-0.5 h-4 w-4 accent-(--color-accent)"
                        />
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 text-label-md text-ink">
                            {r}
                            {editingUser?.role === r && <span className="rounded border border-border px-1 text-[10px] text-ink-faint">Current</span>}
                          </span>
                          <span className="block text-body-sm text-ink-faint">{ROLE_INFO[r]}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                {isSelf && <p className="mt-2 text-body-sm text-ink-faint">You can&apos;t remove your own Admin role, so you can&apos;t lock yourself out.</p>}
              </fieldset>

              {/* Linked employee */}
              <div>
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
                  <div className="mt-2 flex items-center gap-3 rounded-lg border border-border bg-bg/50 p-3">
                    <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[10px] font-semibold text-ink-muted">{initialsOf(linkedEmp.name)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-label-md text-ink">{linkedEmp.name}</p>
                      <p className="truncate text-body-sm text-ink-faint">
                        {linkedEmp.title}
                        {linkedEmp.department ? ` · ${linkedEmp.department}` : ""}
                      </p>
                    </div>
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
                  </div>
                ) : (
                  <p className="mt-2 text-body-sm text-ink-faint">Link a profile so they can see their own leave, attendance, payslips and reviews.</p>
                )}
              </div>

              {/* Password */}
              <div>
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
                  <button type="button" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "Hide password" : "Show password"} className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-ink-faint hover:text-ink">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {msg && (
                <p role={msg.ok ? "status" : "alert"} className={`rounded-lg border px-3 py-2 text-body-sm ${msg.ok ? "border-accent/30 bg-accent-soft text-accent-hover" : "border-critical/40 bg-critical/10 text-critical"}`}>
                  {msg.text}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border p-4">
              {editingUser && !isSelf ? (
                <button onClick={remove} disabled={isPending} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-label-md text-ink-faint transition-colors hover:bg-critical/10 hover:text-critical disabled:opacity-50">
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button onClick={() => setDraft(null)} className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-label-md text-ink-muted transition-colors hover:border-border-strong hover:text-ink">
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={isPending}
                  className="h-9 rounded-lg bg-accent px-4 text-label-md font-semibold text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] transition-colors hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-60"
                >
                  {isPending ? "Saving…" : draft.id === "new" ? "Create account" : "Save changes"}
                </button>
              </div>
            </div>
          </aside>
        )}
      </section>
    </div>
  );
}
