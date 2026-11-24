"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Trash2, Download, Link2, KeyRound, Eye, EyeOff, CheckCircle2, UserRound, Check, Minus } from "lucide-react";
import BottomSheet from "@/components/ui/BottomSheet";
import FilterBar from "@/components/ui/FilterBar";
import ResponsiveList from "@/components/ui/ResponsiveList";
import StatusText from "@/components/ui/StatusText";
import Fab from "@/components/ui/Fab";
import { buttonClass } from "@/components/ui/button";
import { Field, inputClass } from "@/components/ui/form";
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

const capsLabel = "text-eyebrow uppercase text-ink-muted";

// Round initials avatar, tinted by the linked employee's department.
function Avatar({ name, department, size = "h-9 w-9 text-label-sm" }: { name: string; department: string | null; size?: string }) {
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center rounded-full font-semibold text-ink ${size} ${deptTint(department)}`}>
      {name ? initialsOf(name) : <UserRound className="h-5 w-5" />}
    </span>
  );
}

// Role name with its little coloured dot (the words carry the meaning).
function RoleTag({ role, pill = false }: { role: string; pill?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 whitespace-nowrap text-ink ${
        pill ? "rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-label-sm" : ""
      }`}
    >
      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${ROLE_DOT[role] ?? ROLE_DOT.Employee}`} />
      {role}
    </span>
  );
}

/*
  "Added 3 days ago" — how long ago an account was created, measured from the
  server's `now` so the server and browser render the same words. (The app
  doesn't record sign-ins, so this is the only real date we can show.)
*/
function addedAgo(iso: string, now: string) {
  const days = Math.floor((new Date(now).getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Added today";
  if (days === 1) return "Added yesterday";
  if (days < 30) return `Added ${days} days ago`;
  return `Added ${formatDate(iso)}`;
}

/*
  Phone/tablet account card (mockup z26): avatar, name + "You", email, role
  with its dot, and a status pill. The whole card is one button that opens
  the account sheet. The app has no active/suspended flag, so the status is
  whether this login is linked to an employee record.
*/
function AccountCard({
  user,
  department,
  isYou,
  added,
  onOpen,
}: {
  user: UserRow;
  department: string | null;
  isYou: boolean;
  added: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Edit ${user.name}'s account`}
      className="flex w-full items-start gap-3 rounded-xl border border-border bg-surface p-4 text-left transition-colors active:bg-surface-2"
    >
      <Avatar name={user.name} department={department} size="size-12 text-label-md" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-start justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-display text-headline-sm text-ink">{user.name}</span>
            {isYou && <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-label-sm text-on-accent">You</span>}
          </span>
          {user.employeeId ? (
            <StatusText tone="good" variant="pill" className="shrink-0 text-label-sm">
              Linked
            </StatusText>
          ) : (
            <StatusText tone="neutral" variant="pill" className="shrink-0 text-label-sm">
              Not linked
            </StatusText>
          )}
        </span>
        <span className="truncate text-body-sm text-ink-muted">{user.email}</span>
        <span className="flex items-center justify-between gap-2 pt-1 text-label-md">
          <span className="min-w-0 truncate font-semibold">
            <RoleTag role={user.role} />
          </span>
          <span className="tnum shrink-0 text-body-sm text-ink-muted">{added}</span>
        </span>
      </span>
    </button>
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
  // "Are you sure?" step for deleting, shown inside the account sheet.
  const [confirmDelete, setConfirmDelete] = useState(false);

  // The sheet slides away after `draft` becomes null; keep showing the last
  // draft during that animation so its contents don't blank out mid-slide.
  const [lastDraft, setLastDraft] = useState<Draft | null>(null);
  if (draft && draft !== lastDraft) setLastDraft(draft);
  const sheet = draft ?? lastDraft;

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
  const editingUser = sheet && sheet.id !== "new" ? users.find((u) => u.id === sheet.id) ?? null : null;
  const isSelf = sheet?.id === currentUserId;
  // Employees offered in the link dropdown: unlinked ones + whoever this user already has.
  const linkOptions = employees.filter((e) => !linkedIds.has(e.id) || e.id === editingUser?.employeeId);
  const linkedEmp = employees.find((e) => e.id === sheet?.employeeId) ?? null;

  function open(u: UserRow) {
    setMsg(null);
    setShowPw(false);
    setConfirmDelete(false);
    setDraft({ id: u.id, name: u.name, email: u.email, role: u.role, employeeId: u.employeeId ?? "", password: "" });
  }
  function openNew() {
    setMsg(null);
    setShowPw(false);
    setConfirmDelete(false);
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
    // Only runs after the "Delete login" confirm step in the sheet's footer.
    if (!editingUser) return;
    startTransition(async () => {
      try {
        await deleteUser(editingUser.id);
        setConfirmDelete(false);
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

  const label = `mb-1.5 block ${capsLabel}`;
  const closeSheet = () => {
    setConfirmDelete(false);
    setDraft(null);
  };

  // Footer: count, page size, pager. Used under the phone cards and inside the
  // desktop table card (`extra` adds the card's border/padding there).
  // Phones: two tidy rows, 48px controls.
  const pager = (extra: string) => (
    <div className={`flex flex-col gap-3 text-body-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between ${extra}`}>
      <div className="flex items-center justify-between gap-3 sm:justify-start">
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
            className="min-h-tap rounded-full border border-border bg-surface px-3 text-label-md text-ink outline-none focus:border-ink lg:min-h-7 lg:px-2 lg:text-label-sm"
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
        <button
          type="button"
          disabled={current === 0}
          onClick={() => setPage(current - 1)}
          className="min-h-tap flex-1 rounded-full border border-border bg-surface px-4 text-label-md text-ink transition-colors hover:bg-bg disabled:opacity-40 sm:flex-none lg:min-h-8 lg:px-3 lg:text-label-sm"
        >
          Previous
        </button>
        <span className="tnum shrink-0 px-1 text-label-sm text-ink">
          {current + 1} / {pages}
        </span>
        <button
          type="button"
          disabled={current >= pages - 1}
          onClick={() => setPage(current + 1)}
          className="min-h-tap flex-1 rounded-full border border-border bg-surface px-4 text-label-md text-ink transition-colors hover:bg-bg disabled:opacity-40 sm:flex-none lg:min-h-8 lg:px-3 lg:text-label-sm"
        >
          Next
        </button>
      </div>
    </div>
  );

  return (
    <div className="pb-20 lg:pb-0 space-y-8">
      {/* pb-20: room so the floating Fab never covers the last item on phones */}
      {/* ── Editorial header ── */}
      <section className="space-y-1 lg:space-y-4 lg:border-b lg:border-border lg:pb-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="min-w-0 space-y-2">
            <p className={`${capsLabel} max-lg:hidden`}>System · Access &amp; permissions</p>
            <h1 className="text-headline-lg text-ink md:text-headline-xl">Who can sign in.</h1>
            {/* Phones/tablets: just the title + a one-line count summary (below). */}
            <p className="max-w-2xl text-body-md text-ink-muted max-lg:hidden">
              {isPending ? "Working…" : "Manage login accounts, assign roles, and link each login to an employee record."}
            </p>
          </div>
          {/* lg+: both buttons sit here. Phones/tablets: "Add account" is the
              floating yellow button (Fab) and Export moves under the list. */}
          <div className="flex shrink-0 gap-2 max-lg:hidden">
            <button type="button" onClick={exportCsv} className={buttonClass("secondary")}>
              <Download className="h-4 w-4" aria-hidden />
              Export CSV
            </button>
            <button type="button" onClick={openNew} disabled={isPending} className={`${buttonClass("primary")} max-lg:hidden`}>
              <Plus className="h-4 w-4" aria-hidden />
              Add account
            </button>
          </div>
        </div>

        {/* Phones/tablets: a short summary line under the title (real counts). */}
        <p className="tnum text-body-sm text-ink-muted lg:hidden">
          {users.length} account{users.length === 1 ? "" : "s"} · {linked} linked · {users.length - linked} not linked
          {isPending ? " · Working…" : ""}
        </p>

        {/* lg+: the fuller one-line summary strip (all real counts) */}
        <p className="tnum flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-ink-muted max-lg:hidden">
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
          {/* Jump links: 48px tall on touch screens, the slim underline tabs from lg up */}
          {/* Hidden below lg: phones get the mockup's plain search + Filters row;
              the access matrix is still right below the list. */}
          <nav aria-label="Sections" className="flex gap-6 border-b border-border max-lg:hidden">
            <a href="#accounts" className="-mb-px inline-flex min-h-tap items-end border-b-2 border-ink pb-2.5 text-label-md font-semibold text-ink lg:min-h-0">
              Accounts&nbsp;<span className="tnum">({users.length})</span>
            </a>
            <a
              href="#access-matrix"
              className="-mb-px inline-flex min-h-tap items-end border-b-2 border-transparent pb-2.5 text-label-md text-ink-muted transition-colors hover:text-ink lg:min-h-0"
            >
              Roles &amp; permissions
            </a>
          </nav>
          <FilterBar
            title="Role"
            activeCount={roleFilter === "all" ? 0 : 1}
            onReset={() => {
              setRoleFilter("all");
              setPage(0);
            }}
            search={
              <div className="relative w-full md:w-80">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
                <input
                  type="search"
                  autoComplete="off"
                  enterKeyHint="search"
                  aria-label="Search accounts"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(0);
                  }}
                  placeholder="Search accounts by name or email…"
                  className={`${inputClass.replace("px-3.5", "pl-10 pr-4").replace("lg:min-h-11", "lg:min-h-10")} rounded-full`}
                />
              </div>
            }
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-label-md text-ink md:sr-only">Role</span>
              <select
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(0);
                }}
                className={`${inputClass.replace("lg:min-h-11", "lg:min-h-10")} cursor-pointer md:w-auto md:rounded-full md:text-label-md`}
              >
                <option value="all">All roles</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r} ({byRole(r)})
                  </option>
                ))}
              </select>
            </label>
          </FilterBar>
        </div>

        {/* ── Phones/tablets: one tappable card per account ── */}
        {visible.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface py-12 text-center text-body-md text-ink-muted lg:hidden">No accounts match.</p>
        ) : (
          <ul aria-label="User accounts" className="space-y-3 lg:hidden">
            {visible.map((u) => (
              <li key={u.id}>
                <AccountCard
                  user={u}
                  department={deptOf(u.employeeId)}
                  isYou={u.id === currentUserId}
                  added={addedAgo(u.createdAt, now)}
                  onOpen={() => open(u)}
                />
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-3 lg:hidden">
          {pager("")}
          <button type="button" onClick={exportCsv} className={`${buttonClass("ghost", { block: true })}`}>
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </button>
        </div>

        {/* ── lg+: the full table ── */}
        <div id="accounts" className="overflow-hidden rounded-xl border border-border bg-surface max-lg:hidden">
          <ResponsiveList
            inset
            caption="User accounts"
            rows={visible}
            getKey={(u) => u.id}
            listClassName="px-4"
            // `relative` lets the name button below stretch over the whole row,
            // so clicking anywhere on a desktop row opens the account.
            rowClassName={(u) => `relative cursor-pointer ${draft?.id === u.id ? "bg-surface-2" : ""}`}
            empty={<p className="py-12 text-center text-body-md text-ink-muted">No accounts match.</p>}
            columns={[
              {
                key: "user",
                header: "User",
                cell: (u) => (
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={u.name} department={deptOf(u.employeeId)} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-semibold text-ink">
                        <button
                          type="button"
                          onClick={() => open(u)}
                          className="truncate text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ink"
                        >
                          {u.name}
                        </button>
                        {u.id === currentUserId && <span className="rounded bg-surface-2 px-1.5 py-0.5 text-eyebrow uppercase text-ink-muted">You</span>}
                      </p>
                      <p className="truncate text-body-sm text-ink-muted">{u.email}</p>
                    </div>
                  </div>
                ),
              },
              { key: "role", header: "Role", cell: (u) => <RoleTag role={u.role} /> },
              {
                key: "employee",
                header: "Linked employee",
                cell: (u) =>
                  u.employeeName ? (
                    <span className="flex items-center gap-1.5 text-ink">
                      <Link2 className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
                      {u.employeeName}
                    </span>
                  ) : (
                    <span className="text-ink-faint">Not linked</span>
                  ),
              },
              {
                key: "created",
                header: "Created",
                className: "tnum hidden text-ink-muted lg:table-cell",
                headerClassName: "hidden lg:table-cell",
                cell: (u) => formatDate(u.createdAt),
              },
            ]}
            // The phone list is never shown here (this whole box is lg+ only);
            // phones/tablets use the account cards above instead.
            renderRow={() => null}
          />

          {pager("border-t border-border px-4 py-3 md:px-5")}
        </div>
      </section>

      {/* ── System access matrix ── */}
      <section id="access-matrix" className="rounded-xl border border-border bg-surface p-4 sm:p-8">
        <h2 className="text-headline-md text-ink">System access matrix</h2>
        <p className="mt-1 text-body-md text-ink-muted">What each role can do. Everyone can always manage their own leave, attendance and payslips.</p>

        {/* Phones: one card per role listing what it can and can't do (a
            5-column grid would need sideways scrolling at 360px). */}
        <ul className="mt-5 space-y-3 md:hidden">
          {ROLES.map((r) => (
            <li key={r} className="rounded-lg bg-sunken p-3">
              <h3 className="flex items-center justify-between gap-2 text-label-md font-semibold text-ink">
                <RoleTag role={r} />
                <span className="tnum text-body-sm font-normal text-ink-muted">
                  {byRole(r)} account{byRole(r) === 1 ? "" : "s"}
                </span>
              </h3>
              <ul className="mt-3 space-y-2">
                {MATRIX.map((m) => {
                  const ok = m.can(r);
                  return (
                    <li key={m.label} className="flex items-start gap-2.5 text-body-sm">
                      {ok ? (
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-navy text-on-navy" aria-hidden>
                          <Check className="h-3 w-3" />
                        </span>
                      ) : (
                        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center text-ink-faint" aria-hidden>
                          <Minus className="h-3 w-3" />
                        </span>
                      )}
                      <span className={ok ? "text-ink" : "text-ink-faint line-through decoration-ink-faint/50"}>
                        {m.label}
                        <span className="sr-only">{ok ? ": allowed" : ": no access"}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>

        <div className="mt-6 hidden overflow-x-auto md:block">
          <table className="w-full text-left text-body-sm">
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
                        <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-navy text-on-navy" role="img" aria-label="Allowed">
                          <Check className="h-3.5 w-3.5" aria-hidden />
                        </span>
                      ) : (
                        <span className="inline-grid h-6 w-6 place-items-center text-ink-faint" role="img" aria-label="No access">
                          <Minus className="h-3.5 w-3.5" aria-hidden />
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

      <Fab label="Add account" icon={<Plus className="h-5 w-5" />} onClick={openNew} />

      {/* ── Account sheet (bottom sheet on phones, dialog on desktop) ── */}
      <BottomSheet
        open={draft !== null}
        onClose={closeSheet}
        eyebrow="Account"
        title={sheet?.id === "new" ? "Add a new account" : "Edit account permissions"}
        footer={
          confirmDelete && editingUser ? (
            // The "are you sure?" step replaces the normal buttons.
            <div className="flex w-full flex-col gap-3">
              <p role="alert" className="text-body-sm text-ink">
                Delete {editingUser.name}&apos;s login? They won&apos;t be able to sign in. Their employee record is kept.
              </p>
              <div className="flex gap-2 md:justify-end">
                <button type="button" onClick={() => setConfirmDelete(false)} className={`${buttonClass("secondary")} flex-1 md:flex-none`}>
                  Keep account
                </button>
                <button type="button" onClick={remove} disabled={isPending} className={`${buttonClass("danger")} flex-1 md:flex-none`}>
                  {isPending ? "Deleting…" : "Delete login"}
                </button>
              </div>
            </div>
          ) : (
            <>
              {editingUser && !isSelf && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  disabled={isPending}
                  aria-label="Delete account"
                  className={`${buttonClass("ghost")} px-3.5 text-critical hover:bg-critical/10 hover:text-critical`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  {/* Icon-only on narrow phones so three buttons fit */}
                  <span className="hidden sm:inline">Delete</span>
                </button>
              )}
              <button type="button" onClick={closeSheet} className={`${buttonClass("secondary")} flex-1 md:ml-auto md:flex-none`}>
                Cancel
              </button>
              <button type="submit" form="account-form" disabled={isPending} className={`${buttonClass("navy")} flex-1 md:flex-none`}>
                {isPending ? "Saving…" : sheet?.id === "new" ? "Create account" : "Save changes"}
              </button>
            </>
          )
        }
      >
        {sheet && (
          <form
            id="account-form"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            className="space-y-7"
          >
            {/* Identity card */}
            <div className="flex items-center gap-4 rounded-xl border border-border bg-bg p-4">
              <Avatar name={sheet.name} department={linkedEmp?.department ?? null} size="h-12 w-12 text-body-md" />
              <div className="min-w-0">
                <p className="truncate text-label-md font-semibold text-ink">{sheet.id === "new" ? "New account" : sheet.name || "Unnamed"}</p>
                <p className="truncate text-body-sm text-ink-muted">
                  {sheet.id === "new" ? "They'll sign in with this email and password" : sheet.email}
                </p>
                {editingUser && <p className="tnum text-body-sm text-ink-faint">Created {formatDate(editingUser.createdAt)}</p>}
              </div>
            </div>

            {/* Name + email (one column on phones) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name" htmlFor="u-name">
                <input
                  id="u-name"
                  data-autofocus={sheet.id === "new" ? true : undefined}
                  className={inputClass}
                  autoComplete="off"
                  value={sheet.name}
                  onChange={(e) => set({ name: e.target.value })}
                />
              </Field>
              <Field label="Sign-in email" htmlFor="u-email">
                <input
                  id="u-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  className={inputClass}
                  value={sheet.email}
                  onChange={(e) => set({ email: e.target.value })}
                />
              </Field>
            </div>

            {/* Role picker */}
            <fieldset>
              <legend className={`mb-3 ${capsLabel}`}>Assign system role</legend>
              <div className="space-y-2.5">
                {ROLES.map((r) => {
                  const checked = sheet.role === r;
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
                          {editingUser?.role === r && <span className="text-eyebrow uppercase text-ink-muted">Current</span>}
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
              <select id="u-emp" className={`${inputClass} cursor-pointer`} value={sheet.employeeId} onChange={(e) => set({ employeeId: e.target.value })}>
                <option value="">Not linked</option>
                {linkOptions.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              {linkedEmp ? (
                <div className="mt-2 flex items-center gap-3 rounded-xl border border-border bg-bg p-3">
                  <Avatar name={linkedEmp.name} department={linkedEmp.department} size="h-8 w-8 text-label-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-label-md text-ink">{linkedEmp.name}</p>
                    <p className="truncate text-body-sm text-ink-muted">
                      {linkedEmp.title}
                      {linkedEmp.department ? ` · ${linkedEmp.department}` : ""}
                    </p>
                  </div>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-good" aria-label="Linked" />
                </div>
              ) : (
                <p className="mt-2 text-body-sm text-ink-muted">Link a profile so they can see their own leave, attendance, payslips and reviews.</p>
              )}
            </div>

            {/* Password */}
            <div className="border-t border-border pt-6">
              <label htmlFor="u-pw" className={label}>
                {sheet.id === "new" ? "Starting password" : "Reset password"}
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
                <input
                  id="u-pw"
                  type={showPw ? "text" : "password"}
                  autoComplete="new-password"
                  className={`${inputClass} pl-9 pr-12`}
                  value={sheet.password}
                  onChange={(e) => set({ password: e.target.value })}
                  placeholder={sheet.id === "new" ? "At least 8 characters" : "Leave blank to keep their current password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  aria-pressed={showPw}
                  className="absolute right-0 top-1/2 grid size-tap -translate-y-1/2 place-items-center rounded-full text-ink-faint hover:text-ink lg:right-1 lg:size-9"
                >
                  {showPw ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
              </div>
            </div>

            {msg && (
              <p role={msg.ok ? "status" : "alert"} className={`rounded-lg border px-3 py-2 text-body-sm ${msg.ok ? "border-good/30 bg-good/10 text-good" : "border-critical/40 bg-critical/10 text-critical"}`}>
                {msg.text}
              </p>
            )}
          </form>
        )}
      </BottomSheet>
    </div>
  );
}
