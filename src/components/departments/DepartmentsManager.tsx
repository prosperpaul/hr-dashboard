"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Building2,
  Search,
  Download,
  PlusCircle,
  ArrowRight,
  Award,
} from "lucide-react";
import {
  createDepartment,
  updateDepartment,
  deleteDepartment,
  type DepartmentRow,
  type DepartmentInput,
} from "@/lib/department-actions";
import { deptTint } from "@/lib/dept-tint";
import DepartmentFormModal from "./DepartmentFormModal";
import FilterBar from "@/components/ui/FilterBar";
import Fab from "@/components/ui/Fab";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form";
import ConfirmSheet, { type Confirmation } from "@/components/employees/ConfirmSheet";

// Everything one department card shows. Built on the server (page.tsx).
export type DeptCard = DepartmentRow & {
  openRoles: number;
  history: number[]; // headcount at each of the last 12 month-ends
  growthPct: number | null; // vs a year ago
  newThisQuarter: number;
  topRoles: string[];
  roleCount: number;
  members: { id: string; initials: string; name: string }[]; // first few, for the avatar stack
  veteran: { name: string; role: string; initials: string; since: string } | null; // longest-serving member
};

const SORTS = {
  "head-desc": { label: "Headcount (high → low)", fn: (a: DeptCard, b: DeptCard) => b.employeeCount - a.employeeCount },
  "head-asc": { label: "Headcount (low → high)", fn: (a: DeptCard, b: DeptCard) => a.employeeCount - b.employeeCount },
  growth: { label: "Fastest growing", fn: (a: DeptCard, b: DeptCard) => (b.growthPct ?? -Infinity) - (a.growthPct ?? -Infinity) },
  name: { label: "Name (A → Z)", fn: (a: DeptCard, b: DeptCard) => a.name.localeCompare(b.name) },
} as const;
type SortKey = keyof typeof SORTS;

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);

// Small numbers read nicer as words in the big headline ("Seven teams…").
const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
const asWord = (n: number) => WORDS[n] ?? String(n);

// "2021-03-14" → "Mar 2021" (plain string work — no Date objects needed).
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthYear(ymd: string): string {
  const [y, m] = ymd.split("-");
  return `${MONTHS[Number(m) - 1] ?? ""} ${y}`.trim();
}

const CAPS = "text-eyebrow uppercase";

// One figure in the white metrics band under the header.
function Metric({ label, value, note, good }: { label: string; value: string; note?: string; good?: boolean }) {
  return (
    <div className="min-w-0">
      <p className={`${CAPS} text-ink-muted`}>{label}</p>
      <div className="mt-1 flex min-w-0 items-baseline gap-2">
        <span className="tnum truncate text-metric-md text-ink">{value}</span>
        {note && <span className={`truncate text-body-sm font-medium ${good ? "text-good" : "text-ink-muted"}`}>{note}</span>}
      </div>
    </div>
  );
}

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
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("head-desc");
  const [isPending, startTransition] = useTransition();
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  // ── Headline numbers (all from real data) ─────────────────────────
  const assigned = departments.reduce((s, d) => s + d.employeeCount, 0);
  const unassigned = Math.max(totalEmployees - assigned, 0);
  const newThisQuarter = departments.reduce((s, d) => s + d.newThisQuarter, 0);
  const fastest = [...departments].filter((d) => d.growthPct !== null).sort(SORTS.growth.fn)[0];
  const openRoles = departments.reduce((s, d) => s + d.openRoles, 0);
  const hiringDepts = departments.filter((d) => d.openRoles > 0).length;
  const n = departments.length;

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

  // Each department keeps a stable "Unit #01" number (alphabetical order),
  // so the number doesn't jump around when you change the sort.
  const unitNo = new Map(
    [...departments].sort((a, b) => a.name.localeCompare(b.name)).map((d, i) => [d.id, String(i + 1).padStart(2, "0")]),
  );

  // ── Actions (permission re-checked on the server) ─────────────────
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
        if (id) await updateDepartment(id, data);
        else await createDepartment(data);
        setModalOpen(false);
        router.refresh(); // re-fetch the server data so counts stay correct
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Could not save the department.");
      }
    });
  }
  function handleDelete(dept: DeptCard) {
    const warn =
      dept.employeeCount > 0
        ? `${dept.name} has ${dept.employeeCount} employee(s). Deleting it won't remove them, but they'll no longer belong to a department. Continue?`
        : `Delete the ${dept.name} department?`;
    // Ask first in a small sheet (instead of the browser's confirm box).
    setConfirmation({
      title: `Delete ${dept.name}?`,
      message: warn,
      confirmLabel: "Delete department",
      danger: true,
      onConfirm: () =>
        startTransition(async () => {
          try {
            await deleteDepartment(dept.id);
            router.refresh();
          } catch (err) {
            window.alert(err instanceof Error ? err.message : "Could not delete this department.");
          }
        }),
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
    <div className="pb-20 lg:pb-0 space-y-6">
      {/* pb-20: room so the floating Fab never covers the last item on phones */}
      {/* ── Editorial header ── */}
      <header className="flex flex-col justify-between gap-5 border-b border-border pb-6 xl:flex-row xl:items-end">
        <div className="max-w-3xl">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-full bg-navy px-2.5 py-0.5 ${CAPS} text-on-navy`}>Department atlas</span>
            <span className="text-body-sm text-ink-muted">· Organization</span>
          </div>
          <h1 className="text-headline-lg text-ink md:text-headline-xl">
            {n === 1 ? "One team, one company." : `${asWord(n)} teams, one company.`}
          </h1>
          <p className="mt-1 text-body-lg text-ink-muted">
            {isPending
              ? "Saving…"
              : `${assigned} ${assigned === 1 ? "person" : "people"} across ${n} ${n === 1 ? "department" : "departments"}${
                  unassigned > 0 ? `, ${unassigned} not yet assigned` : ""
                }.`}
          </p>
        </div>

        {/* Phones: search + a "Sort" button (the sort menu lives in its sheet),
            then Export at full width ("Add" is the floating Fab below lg). Desktop: one row. */}
        <div className="flex min-w-0 flex-col gap-2 md:flex-row md:flex-wrap md:items-center">
          <FilterBar
            title="Sort"
            activeCount={sort === "head-desc" ? 0 : 1}
            onReset={() => setSort("head-desc")}
            search={
              <div className="relative w-full md:w-56">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden />
                <input
                  type="search"
                  autoComplete="off"
                  enterKeyHint="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter departments…"
                  aria-label="Filter departments"
                  className={`${inputClass.replace("px-3.5", "pl-9 pr-3").replace("lg:min-h-11", "lg:min-h-10")} rounded-full`}
                />
              </div>
            }
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-label-md text-ink md:sr-only">Sort departments</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className={`${inputClass.replace("lg:min-h-11", "lg:min-h-10")} cursor-pointer md:w-auto md:rounded-full md:text-label-md`}
              >
                {Object.entries(SORTS).map(([key, s]) => (
                  <option key={key} value={key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </FilterBar>
          <div className="flex gap-2 [&>*]:flex-1 md:[&>*]:flex-none">
            <button type="button" onClick={exportCsv} disabled={n === 0} className={buttonClass("secondary")}>
              <Download className="h-4 w-4" aria-hidden />
              Export CSV
            </button>
            {canManage && (
              <button type="button" onClick={openAdd} disabled={isPending} className={`${buttonClass("primary")} max-lg:hidden`}>
                <PlusCircle className="h-4 w-4" aria-hidden />
                Add department
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── Metrics band ── */}
      <section className="grid grid-cols-2 gap-x-4 gap-y-5 rounded-xl border border-border bg-surface px-4 py-4 md:grid-cols-4 md:px-5">
        <Metric
          label="Total headcount"
          value={String(totalEmployees)}
          note={newThisQuarter > 0 ? `+${newThisQuarter} this quarter` : undefined}
          good={newThisQuarter > 0}
        />
        <Metric label="Departments" value={String(n)} note={`${pct(assigned, totalEmployees)}% of people placed`} />
        <Metric
          label="Open positions"
          value={String(openRoles)}
          note={openRoles > 0 ? `Across ${hiringDepts} ${hiringDepts === 1 ? "team" : "teams"}` : "Fully staffed"}
        />
        <Metric
          label="Fastest growing"
          value={fastest?.name ?? "—"}
          note={fastest?.growthPct != null ? `${fastest.growthPct >= 0 ? "+" : "−"}${Math.abs(fastest.growthPct)}% YoY` : undefined}
          good={(fastest?.growthPct ?? 0) > 0}
        />
      </section>

      {/* ── Department cards ── */}
      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((d) => {
          const tint = deptTint(d.name);
          const extra = d.employeeCount - d.members.length;
          const g = d.growthPct;

          return (
            <article key={d.id} className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-border-strong">
              {/* Thin department-colour bar across the top */}
              <div className={`h-2.5 w-full ${tint}`} />

              <div className="flex min-w-0 flex-1 flex-col p-4 md:p-5">
                {/* Name + member count */}
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`${CAPS} truncate text-ink-muted`}>
                      {d.roleCount} {d.roleCount === 1 ? "role" : "roles"} · {pct(d.employeeCount, totalEmployees)}% of company
                    </p>
                    <h2 className="mt-0.5 truncate text-headline-md text-ink">{d.name}</h2>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="tnum text-metric-md text-ink">{d.employeeCount}</span>
                    <span className={`block ${CAPS} text-ink-muted`}>{d.employeeCount === 1 ? "Member" : "Members"}</span>
                  </div>
                </div>

                {/* Open-roles pill + growth */}
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {d.openRoles > 0 ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-label-sm text-ink">
                      <span className="h-1.5 w-1.5 rounded-full bg-ink" />
                      {d.openRoles} open {d.openRoles === 1 ? "role" : "roles"}
                      <span className="text-ink-muted">· Hiring</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-navy px-2.5 py-1 text-label-sm text-on-navy">
                      <span className="h-1.5 w-1.5 rounded-full bg-on-navy-muted" />
                      Fully staffed
                      <span className="text-on-navy-muted">· 0 open roles</span>
                    </span>
                  )}
                  <span className={`text-label-sm ${g && g > 0 ? "text-good" : "text-ink-muted"}`}>
                    {g === null ? "New team" : `${g >= 0 ? "+" : "−"}${Math.abs(g)}% YoY`}
                  </span>
                </div>

                {/* Description, styled as a pulled quote */}
                <p className="mb-5 line-clamp-3 rounded-r-md border-l-2 border-ink bg-bg p-3 text-body-sm italic text-ink">
                  {d.description || "No description yet."}
                </p>

                {/* Longest-serving member (real data; there's no "head of department" field) */}
                {d.veteran && (
                  <div className="mb-5 flex items-center gap-3 rounded-lg bg-sunken p-3 lg:rounded-xl lg:border lg:border-border lg:bg-transparent">
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${tint} text-label-md font-semibold text-ink`}>
                      {d.veteran.initials}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-label-md font-semibold text-ink">{d.veteran.name}</p>
                      <p className="truncate text-body-sm text-ink-muted">{d.veteran.role}</p>
                    </div>
                    <span className="flex shrink-0 flex-col items-end text-right" title="Longest-serving member">
                      <Award className="h-4 w-4 text-accent-ink" aria-hidden />
                      <span className="tnum mt-0.5 text-label-sm text-ink-muted">Since {monthYear(d.veteran.since)}</span>
                    </span>
                  </div>
                )}

                {/* Avatar stack + common roles */}
                <div className="mt-auto flex items-center justify-between gap-3">
                  <div className="flex shrink-0 items-center -space-x-2">
                    {d.members.map((m) => (
                      <span
                        key={m.id}
                        title={m.name}
                        className={`grid h-7 w-7 place-items-center rounded-full border-2 border-surface ${tint} text-[10px] font-semibold text-ink`}
                      >
                        {m.initials}
                      </span>
                    ))}
                    {extra > 0 && (
                      <span className="tnum grid h-7 min-w-7 place-items-center rounded-full border-2 border-surface bg-navy px-1 text-[10px] font-bold text-on-navy">
                        +{extra}
                      </span>
                    )}
                    {d.members.length === 0 && <span className="text-body-sm text-ink-faint">No members yet</span>}
                  </div>
                  <span className="truncate text-right text-body-sm text-ink-muted" title={d.topRoles.join(" · ")}>
                    {d.topRoles.join(" · ")}
                  </span>
                </div>
              </div>

              {/* Footer strip: unit number + actions */}
              <div className="flex items-center justify-between gap-2 border-t border-border bg-bg px-4 py-1 md:px-5 lg:py-3">
                <span className={`${CAPS} text-ink-muted`}>Unit #{unitNo.get(d.id)}</span>
                {canManage ? (
                  <div className="flex items-center gap-1">
                    {/* 48px targets on touch screens, compact from lg up */}
                    <button
                      type="button"
                      onClick={() => openEdit(d)}
                      disabled={isPending}
                      className="inline-flex min-h-tap items-center lg:min-h-8 gap-1.5 rounded-full px-3 text-label-md text-ink transition-colors hover:bg-surface-2 disabled:opacity-50"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(d)}
                      disabled={isPending}
                      aria-label={`Delete ${d.name}`}
                      className="grid size-tap place-items-center rounded-full text-ink-muted lg:size-8 transition-colors hover:bg-critical/10 hover:text-critical disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                ) : (
                  <Link href="/employees" className="inline-flex min-h-tap items-center gap-1 text-label-md text-ink hover:underline lg:min-h-0">
                    View directory <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                )}
              </div>
            </article>
          );
        })}

        {/* "Add a department" tile (managers only, hidden while filtering) */}
        {canManage && !q && (
          <button
            type="button"
            onClick={openAdd}
            disabled={isPending}
            className="group flex min-h-72 flex-col items-center justify-center rounded-xl border border-dashed border-border-strong p-5 text-center transition-colors hover:bg-surface"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-accent text-on-accent transition-colors group-hover:bg-accent-hover">
              <Plus className="h-5 w-5" aria-hidden />
            </span>
            <span className="mt-3 text-headline-sm text-ink">Establish a new unit</span>
            <span className="mt-1 max-w-56 text-body-sm text-ink-muted">Create a department, then assign people to it from Employees.</span>
          </button>
        )}
      </section>

      {/* Empty states */}
      {visible.length === 0 && (
        <div className="grid place-items-center rounded-xl border border-border bg-surface py-16 text-center">
          <div>
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-surface-2">
              <Building2 className="h-5 w-5 text-ink-faint" aria-hidden />
            </div>
            <p className="mt-3 text-headline-sm text-ink">{q ? "No matching departments" : "No departments yet"}</p>
            <p className="mt-1 text-body-md text-ink-muted">
              {q ? "Try a different search." : canManage ? "Add your first department to get started." : "Check back later."}
            </p>
          </div>
        </div>
      )}

      {/* Phones/tablets: "Add department" floats above the tab bar instead of sitting in the header */}
      {canManage && <Fab label="Add department" icon={<Plus className="h-5 w-5" />} onClick={openAdd} />}
      <ConfirmSheet confirmation={confirmation} onClose={() => setConfirmation(null)} />
      <DepartmentFormModal open={modalOpen} editing={editing} onClose={() => setModalOpen(false)} onSave={handleSave} />
    </div>
  );
}
