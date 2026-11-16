"use client";

import { useState } from "react";
import { Search, ArrowRight } from "lucide-react";
import { formatLeaveRange, leaveStyle, type LeaveRow } from "@/lib/leave";
import { deptBadgeClass } from "@/lib/dept-tint";
import Avatar from "./Avatar";

export type BalanceRow = {
  id: string;
  name: string;
  email: string;
  department: string | null;
  allowance: number;
  used: number;
  remaining: number;
  upcoming: LeaveRow | null; // next approved/pending leave that hasn't ended
};

const PAGE_SIZE = 8;

// Everyone's paid-leave allowance, usage and next scheduled time off.
export default function LeaveBalances({ rows, year }: { rows: BalanceRow[]; year: number }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const q = query.trim().toLowerCase();
  const filtered = rows.filter(
    (r) => !q || r.name.toLowerCase().includes(q) || (r.department ?? "").toLowerCase().includes(q) || r.email.toLowerCase().includes(q),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1); // stay in range when the filter shrinks the list
  const visible = filtered.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  return (
    <section id="balances" className="scroll-mt-24 overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-col justify-between gap-3 border-b border-border p-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Allowances</p>
          <h2 className="text-headline-md text-ink">Leave balances</h2>
          <p className="text-body-sm text-ink-muted">
            Paid allowance for {year} · Vacation &amp; Personal count against it, Sick &amp; Unpaid don&apos;t
          </p>
        </div>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Filter employees…"
            className="h-9 w-full rounded-full border border-border bg-surface pl-8 pr-3 text-body-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-ink focus:ring-1 focus:ring-ink"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px] leading-[18px]">
          <thead>
            <tr className="border-b border-border bg-bg text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
              <th className="px-5 py-3">Employee</th>
              <th className="hidden px-4 py-3 md:table-cell">Department</th>
              <th className="hidden px-4 py-3 lg:table-cell">Entitlement</th>
              <th className="px-4 py-3">Days used</th>
              <th className="px-4 py-3">Remaining</th>
              <th className="hidden px-5 py-3 sm:table-cell">Upcoming</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const usedPct = r.allowance ? Math.min(100, (r.used / r.allowance) * 100) : 0;
              const low = r.allowance > 0 && r.remaining / r.allowance < 0.25; // under a quarter left
              return (
                <tr key={r.id} className="h-12 border-b border-border last:border-0 hover:bg-bg">
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.name} department={r.department} size={30} />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{r.name}</p>
                        <p className="truncate text-body-sm text-ink-muted">{r.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-2.5 md:table-cell">{r.department ? <span className={deptBadgeClass(r.department)}>{r.department}</span> : <span className="text-ink-muted">—</span>}</td>
                  <td className="tnum hidden px-4 py-2.5 text-ink-muted lg:table-cell">{r.allowance} days / yr</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="tnum w-9 text-ink">{r.used}d</span>
                      <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-surface-2 sm:block">
                        <span className={`block h-full rounded-full ${low ? "bg-warning" : "bg-navy"}`} style={{ width: `${usedPct}%` }} />
                      </span>
                    </div>
                  </td>
                  <td className={`tnum px-4 py-2.5 font-medium ${low ? "text-warning" : "text-ink"}`}>
                    {r.remaining} {r.remaining === 1 ? "day" : "days"}
                  </td>
                  <td className="hidden px-5 py-2.5 sm:table-cell">
                    {r.upcoming ? (
                      <span
                        className={[
                          "inline-flex rounded-full border px-2.5 py-0.5 text-label-sm",
                          leaveStyle(r.upcoming.type).chip,
                          r.upcoming.status === "Pending" ? "border-dashed" : "",
                        ].join(" ")}
                      >
                        {formatLeaveRange(r.upcoming.startDate, r.upcoming.endDate)} · {r.upcoming.type}
                        {r.upcoming.status === "Pending" ? " (pending)" : ""}
                      </span>
                    ) : (
                      <span className="text-body-sm text-ink-muted">None scheduled</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && <p className="py-10 text-center text-body-md text-ink-muted">No matching employees.</p>}
      </div>

      <div className="flex items-center justify-between border-t border-border px-5 py-3 text-body-sm text-ink-muted">
        <span>
          Showing <span className="tnum text-ink">{visible.length}</span> of <span className="tnum text-ink">{filtered.length}</span> employees
        </span>
        <div className="flex items-center gap-2">
          <button
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
            className="h-8 rounded-full border border-border bg-surface px-3 text-label-sm text-ink transition-colors hover:bg-bg disabled:opacity-40"
          >
            Previous
          </button>
          <span className="tnum text-label-sm text-ink">
            Page {current + 1} of {pages}
          </span>
          <button
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
            className="h-8 rounded-full border border-border bg-surface px-3 text-label-sm text-ink transition-colors hover:bg-bg disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}

/*
  "Balance spotlight" card for the right-hand rail. It's generic: the page
  passes in a title and a few rows, each with a label, a "x of y" figure and
  an optional progress bar (0–100) and note.
*/
export type SpotlightItem = { label: string; figure: string; pct?: number; note?: string; warn?: boolean };

export function BalanceSpotlight({
  eyebrow,
  title,
  badge,
  items,
  linkHref,
  linkLabel,
}: {
  eyebrow: string;
  title: string;
  badge?: string;
  items: SpotlightItem[];
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">{eyebrow}</p>
          <h2 className="truncate text-headline-sm text-ink">{title}</h2>
        </div>
        {badge && <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-label-sm font-semibold text-ink">{badge}</span>}
      </div>

      <div className="mt-4 space-y-5">
        {items.map((it) => (
          <div key={it.label}>
            <div className="flex items-baseline justify-between gap-2 text-body-md">
              <span className="font-semibold text-ink">{it.label}</span>
              <span className={`tnum text-right ${it.warn ? "text-warning" : "text-ink-muted"}`}>{it.figure}</span>
            </div>
            {it.pct !== undefined && (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                <div className={`h-full rounded-full ${it.warn ? "bg-warning" : "bg-navy"}`} style={{ width: `${Math.max(0, Math.min(100, it.pct))}%` }} />
              </div>
            )}
            {it.note && <p className="mt-1.5 text-body-sm text-ink-muted">{it.note}</p>}
          </div>
        ))}
      </div>

      {linkHref && linkLabel && (
        <a href={linkHref} className="mt-5 flex items-center justify-between border-t border-border pt-4 text-label-md font-semibold text-ink hover:underline">
          {linkLabel}
          <ArrowRight className="h-4 w-4" />
        </a>
      )}
    </section>
  );
}
