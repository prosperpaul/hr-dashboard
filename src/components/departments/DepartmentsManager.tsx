"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Building2,
  Users,
  Search,
  Download,
  MoreHorizontal,
  TrendingUp,
  TrendingDown,
  Minus,
  SquareTerminal,
  Shapes,
  Megaphone,
  Workflow,
  Landmark,
  Headset,
  Scale,
  type LucideIcon,
} from "lucide-react";
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
  type DepartmentRow,
  type DepartmentInput,
} from "@/lib/department-actions";
import StatCard, { Sparkline, type DashStat } from "@/components/dashboard/StatCard";
import { Pill } from "@/components/dashboard/Panel";
import DepartmentFormModal from "./DepartmentFormModal";

// Everything one department card shows. Built on the server (page.tsx).
export type DeptCard = DepartmentRow & {
  openRoles: number;
  history: number[]; // headcount at each of the last 12 month-ends
  growthPct: number | null; // vs a year ago
  newThisQuarter: number;
  topRoles: string[];
  roleCount: number;
  members: { id: string; initials: string; name: string }[]; // first few, for the avatar stack
};

const SORTS = {
  "head-desc": { label: "Headcount (high → low)", fn: (a: DeptCard, b: DeptCard) => b.employeeCount - a.employeeCount },
  "head-asc": { label: "Headcount (low → high)", fn: (a: DeptCard, b: DeptCard) => a.employeeCount - b.employeeCount },
  growth: { label: "Fastest growing", fn: (a: DeptCard, b: DeptCard) => (b.growthPct ?? -Infinity) - (a.growthPct ?? -Infinity) },
  name: { label: "Name (A → Z)", fn: (a: DeptCard, b: DeptCard) => a.name.localeCompare(b.name) },
} as const;
type SortKey = keyof typeof SORTS;

// Pick an icon from the department's name; fall back to a building.
function iconFor(name: string): LucideIcon {
  const n = name.toLowerCase();
  if (/engineer|tech|it\b|dev/.test(n)) return SquareTerminal;
  if (/sales|growth|revenue|business/.test(n)) return TrendingUp;
  if (/design|product/.test(n)) return Shapes;
  if (/market|brand|comm/.test(n)) return Megaphone;
  if (/operat|logistic/.test(n)) return Workflow;
  if (/financ|account/.test(n)) return Landmark;
  if (/people|hr|human|talent/.test(n)) return Users;
  if (/support|service|customer/.test(n)) return Headset;
  if (/legal|complian/.test(n)) return Scale;
  return Building2;
}

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);

export default function DepartmentsManager({
  departments,
  totalEmployees,
  canManage,
}: {
  departments: DeptCard[];
  totalEmployees: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<DepartmentRow | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null); // which card's "…" menu is open
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("head-desc");
  const [isPending, startTransition] = useTransition();

  // ── Headline numbers ──────────────────────────────────────────────
  const assigned = departments.reduce((s, d) => s + d.employeeCount, 0);
  const newThisQuarter = departments.reduce((s, d) => s + d.newThisQuarter, 0);
  const largest = [...departments].sort(SORTS["head-desc"].fn)[0];
  const fastest = [...departments].filter((d) => d.growthPct !== null).sort(SORTS.growth.fn)[0];
  const openRoles = departments.reduce((s, d) => s + d.openRoles, 0);
  const hiringDepts = departments.filter((d) => d.openRoles > 0).length;

  const stats: DashStat[] = [
    {
      key: "headcount",
      label: "Total headcount",
      value: String(totalEmployees),
      badge: newThisQuarter > 0 ? { text: `+${newThisQuarter} this qtr`, trend: "up" } : undefined,
      bar: [
        { value: assigned, className: "bg-accent" },
        { value: Math.max(totalEmployees - assigned, 0), className: "bg-transparent" },
      ],
      footer: { label: "In a department", value: `${assigned} (${pct(assigned, totalEmployees)}%)` },
    },
    {
      key: "largest",
      label: "Largest department",
      value: largest?.name ?? "—",
      footer: largest
        ? { label: `${largest.employeeCount} members`, value: `${pct(largest.employeeCount, totalEmployees)}% of company`, accent: true }
        : undefined,
    },
    {
      key: "fastest",
      label: "Fastest growing",
      value: fastest?.name ?? "—",
      badge:
        fastest?.growthPct != null
          ? { text: `${fastest.growthPct >= 0 ? "+" : "−"}${Math.abs(fastest.growthPct)}% YoY`, tone: fastest.growthPct > 0 ? "accent" : "neutral" }
          : undefined,
      footer: fastest ? { label: "Team size", value: `${fastest.employeeCount} members` } : { label: "Needs a year of history", value: "" },
    },
    {
      key: "open",
      label: "Open positions",
      value: String(openRoles),
      side: (
        <span className="mb-1 mr-auto ml-2 text-body-sm text-ink-faint">
          across {hiringDepts} {hiringDepts === 1 ? "department" : "departments"}
        </span>
      ),
      badge: openRoles > 0 ? { text: "Hiring", dot: true } : { text: "Fully staffed", tone: "neutral" },
      footer: { label: "Departments", value: `${departments.length} total` },
    },
  ];

  // ── Filter + sort ─────────────────────────────────────────────────
  const q = query.trim().toLowerCase();
  const visible = departments
    .filter(
      (d) =>
        !q ||
        d.name.toLowerCase().includes(q) ||
        (d.description ?? "").toLowerCase().includes(q) ||
        d.topRoles.some((r) => r.toLowerCase().includes(q)),
    )
    .sort(SORTS[sort].fn);

  // ── Actions (permission re-checked on the server) ─────────────────
  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(dept: DepartmentRow) {
    setMenuFor(null);
    setEditing(dept);
    setModalOpen(true);
  }
  function handleSave(data: DepartmentInput, id?: string) {
    startTransition(async () => {
      try {
        if (id) await updateDepartment(id, data);
        else await createDepartment(data);
        setModalOpen(false);
        router.refresh(); // re-fetch the server data so counts/charts stay correct
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Could not save the department.");
      }
    });
  }
  function handleDelete(dept: DeptCard) {
    setMenuFor(null);
    const warn =
      dept.employeeCount > 0
        ? `${dept.name} has ${dept.employeeCount} employee(s). Deleting it won't remove them, but they'll no longer belong to a department. Continue?`
        : `Delete the ${dept.name} department?`;
    if (!window.confirm(warn)) return;
    startTransition(async () => {
      try {
        await deleteDepartment(dept.id);
        router.refresh();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Could not delete this department.");
      }
    });
  }

  // Download the department list as a CSV file (built in the browser).
  function exportCsv() {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`; // quote every cell safely
    const rows = [
      ["Department", "Description", "Headcount", "% of company", "YoY growth %", "Open roles", "Common roles"],
      ...departments.map((d) => [
        d.name,
        d.description ?? "",
        d.employeeCount,
        pct(d.employeeCount, totalEmployees),
        d.growthPct ?? "",
        d.openRoles,
        d.topRoles.join("; "),
      ]),
    ];
    const csv = rows.map((r) => r.map(esc).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `departments-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <section className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-label-sm uppercase tracking-wider text-ink-faint">
            <span>Organization</span>
            <span>/</span>
            <span className="normal-case tracking-normal text-accent-hover">Departments</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-headline-lg text-ink md:text-headline-xl">Departments</h1>
            <Pill dot>
              {departments.length} units · {assigned} headcount
            </Pill>
          </div>
          <p className="max-w-2xl text-body-md text-ink-muted">
            {isPending ? "Saving…" : "Your organization's departments, their headcount, growth and open roles."}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={departments.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-3 text-label-md text-ink transition-colors hover:border-border-strong hover:bg-white/[0.03] disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          {canManage && (
            <button
              onClick={openAdd}
              disabled={isPending}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-label-md font-semibold text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] transition-colors hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Add department
            </button>
          )}
        </div>
      </section>

      {/* ── KPI cards ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.key} stat={s} />
        ))}
      </section>

      {/* ── Toolbar ── */}
      <section className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter departments, descriptions, roles…"
            className="h-9 w-full rounded-lg border border-border bg-surface-2 pl-8 pr-3 text-body-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
        <select
          aria-label="Sort departments"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-label-md text-ink outline-none transition-colors hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent"
        >
          {Object.entries(SORTS).map(([key, s]) => (
            <option key={key} value={key}>
              {s.label}
            </option>
          ))}
        </select>
      </section>

      {/* ── Department cards ── */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((d) => {
          const Icon = iconFor(d.name);
          const g = d.growthPct;
          const Trend = g === null || g === 0 ? Minus : g > 0 ? TrendingUp : TrendingDown;
          const extra = d.employeeCount - d.members.length;

          return (
            <article
              key={d.id}
              className="relative flex flex-col rounded-xl border border-border bg-surface p-5 transition-colors duration-150 hover:border-border-strong"
            >
              {/* Title row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-surface-2">
                    <Icon className="h-5 w-5 text-accent-hover" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-headline-md text-ink">{d.name}</h2>
                    <p className="text-label-sm uppercase tracking-wider text-ink-faint">
                      {d.roleCount} {d.roleCount === 1 ? "role" : "roles"}
                    </p>
                  </div>
                </div>

                {canManage && (
                  <div className="relative">
                    <button
                      onClick={() => setMenuFor(menuFor === d.id ? null : d.id)}
                      aria-label={`Options for ${d.name}`}
                      aria-expanded={menuFor === d.id}
                      className="grid h-8 w-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    {menuFor === d.id && (
                      <>
                        {/* invisible layer: clicking anywhere else closes the menu */}
                        <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                        <div className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-border-strong bg-surface-2 p-1 shadow-popover">
                          <button
                            onClick={() => openEdit(d)}
                            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-label-md text-ink-muted transition-colors hover:bg-white/[0.04] hover:text-ink"
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </button>
                          <button
                            onClick={() => handleDelete(d)}
                            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-label-md text-ink-muted transition-colors hover:bg-critical/10 hover:text-critical"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Description (where the mockup shows a department lead) */}
              <p className="mt-4 line-clamp-2 min-h-10 rounded-lg border border-border bg-bg/50 px-3 py-2 text-body-sm text-ink-muted">
                {d.description || "No description yet."}
              </p>

              {/* Headcount + trend */}
              <div className="mt-4 flex items-end justify-between gap-3">
                <div>
                  <p className="text-ink">
                    <span className="tnum text-metric-lg">{d.employeeCount}</span>
                    <span className="tnum ml-1 text-body-sm text-ink-faint">/ {totalEmployees}</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-label-sm">
                    <Trend className={`h-3 w-3 ${g && g > 0 ? "text-accent-hover" : "text-ink-faint"}`} />
                    <span className={g && g > 0 ? "text-accent-hover" : "text-ink-faint"}>
                      {g === null ? "New" : `${g >= 0 ? "+" : "−"}${Math.abs(g)}% YoY`}
                    </span>
                    <span className="text-ink-faint">· {pct(d.employeeCount, totalEmployees)}% of co.</span>
                  </p>
                </div>
                <Sparkline values={d.history} id={`dept-${d.id}`} />
              </div>

              {/* Members */}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center -space-x-2">
                  {d.members.map((m) => (
                    <span
                      key={m.id}
                      title={m.name}
                      className="grid h-7 w-7 place-items-center rounded-full border-2 border-surface bg-surface-2 text-[10px] font-semibold text-ink-muted"
                    >
                      {m.initials}
                    </span>
                  ))}
                  {extra > 0 && (
                    <span className="tnum grid h-7 min-w-7 place-items-center rounded-full border-2 border-surface bg-bg px-1 text-[10px] text-ink-faint">
                      +{extra}
                    </span>
                  )}
                  {d.members.length === 0 && <span className="text-body-sm text-ink-faint">No members yet</span>}
                </div>
              </div>

              {/* Role tags */}
              <div className="mt-4 flex min-h-6 flex-wrap gap-1.5">
                {d.topRoles.map((r) => (
                  <span key={r} className="max-w-full truncate rounded-md border border-border bg-surface-2 px-2 py-0.5 text-label-sm text-ink-muted">
                    {r}
                  </span>
                ))}
              </div>

              {/* Open roles */}
              <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-body-sm">
                <span className="text-ink-faint">Open positions</span>
                {d.openRoles > 0 ? (
                  <span className="flex items-center gap-1.5 text-label-sm text-accent-hover">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
                    {d.openRoles} open {d.openRoles === 1 ? "role" : "roles"}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-label-sm text-ink-faint">
                    <span className="h-1.5 w-1.5 rounded-full bg-ink-faint" />
                    Fully staffed
                  </span>
                )}
              </div>
            </article>
          );
        })}

        {/* "Add a department" tile (managers only, hidden while filtering) */}
        {canManage && !q && (
          <button
            onClick={openAdd}
            disabled={isPending}
            className="group flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border-strong bg-surface/40 p-5 text-center transition-colors hover:border-accent/50 hover:bg-surface"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full border border-border-strong text-ink-muted transition-colors group-hover:border-accent/50 group-hover:text-accent-hover">
              <Plus className="h-5 w-5" />
            </span>
            <span className="mt-3 text-headline-sm text-ink">Establish new unit</span>
            <span className="mt-1 max-w-56 text-body-sm text-ink-faint">Create a department, then assign people to it from Employees.</span>
          </button>
        )}
      </section>

      {/* Empty states */}
      {visible.length === 0 && (
        <div className="grid place-items-center rounded-xl border border-border bg-surface py-16 text-center">
          <div>
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface-2">
              <Building2 className="h-5 w-5 text-ink-faint" />
            </div>
            <p className="mt-3 text-headline-sm text-ink">{q ? "No matching departments" : "No departments yet"}</p>
            <p className="mt-1 text-body-md text-ink-muted">
              {q ? "Try a different search." : canManage ? "Add your first department to get started." : "Check back later."}
            </p>
          </div>
        </div>
      )}

      <DepartmentFormModal open={modalOpen} editing={editing} onClose={() => setModalOpen(false)} onSave={handleSave} />
    </div>
  );
}
