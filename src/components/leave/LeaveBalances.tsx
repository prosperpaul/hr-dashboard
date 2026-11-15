"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { initialsOf } from "@/lib/sample-data";
import { formatLeaveRange, leaveStyle, type LeaveRow } from "@/lib/leave";

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
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-col justify-between gap-3 border-b border-border p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-headline-md text-ink">Leave Balances &amp; Utilization</h2>
          <p className="text-body-sm text-ink-faint">
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
            className="h-9 w-full rounded-lg border border-border bg-surface-2 pl-8 pr-3 text-body-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px] leading-[18px]">
          <thead>
            <tr className="border-b border-border text-label-sm uppercase tracking-[0.05em] text-ink-faint">
              <th className="px-5 py-3 font-medium">Employee</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Department</th>
              <th className="hidden px-4 py-3 font-medium lg:table-cell">Entitlement</th>
              <th className="px-4 py-3 font-medium">Days used</th>
              <th className="px-4 py-3 font-medium">Remaining</th>
              <th className="hidden px-5 py-3 font-medium sm:table-cell">Upcoming</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const usedPct = r.allowance ? Math.min(100, (r.used / r.allowance) * 100) : 0;
              const low = r.allowance > 0 && r.remaining / r.allowance < 0.25; // under a quarter left
              return (
                <tr key={r.id} className="h-14 border-b border-border last:border-0 hover:bg-surface-2">
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent-hover">
                        {initialsOf(r.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{r.name}</p>
                        <p className="truncate text-body-sm text-ink-faint">{r.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-2.5 text-ink-muted md:table-cell">{r.department ?? "—"}</td>
                  <td className="tnum hidden px-4 py-2.5 text-ink-muted lg:table-cell">{r.allowance} days / yr</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="tnum w-9 text-ink">{r.used}d</span>
                      <span className="hidden h-1 w-16 overflow-hidden rounded-full bg-bg sm:block">
                        <span className={`block h-full rounded-full ${low ? "bg-warning" : "bg-accent"}`} style={{ width: `${usedPct}%` }} />
                      </span>
                    </div>
                  </td>
                  <td className={`tnum px-4 py-2.5 font-medium ${low ? "text-warning" : "text-accent-hover"}`}>
                    {r.remaining} {r.remaining === 1 ? "day" : "days"}
                  </td>
                  <td className="hidden px-5 py-2.5 sm:table-cell">
                    {r.upcoming ? (
                      <span
                        className={[
                          "inline-flex rounded-md border px-2 py-0.5 text-label-sm",
                          leaveStyle(r.upcoming.type).chip,
                          r.upcoming.status === "Pending" ? "border-dashed" : "",
                        ].join(" ")}
                      >
                        {formatLeaveRange(r.upcoming.startDate, r.upcoming.endDate)} · {r.upcoming.type}
                        {r.upcoming.status === "Pending" ? " (pending)" : ""}
                      </span>
                    ) : (
                      <span className="text-body-sm text-ink-faint">None scheduled</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 && <p className="py-10 text-center text-body-md text-ink-muted">No matching employees.</p>}
      </div>

      <div className="flex items-center justify-between border-t border-border px-5 py-3 text-body-sm text-ink-faint">
        <span>
          Showing <span className="tnum text-ink">{visible.length}</span> of <span className="tnum text-ink">{filtered.length}</span> employees
        </span>
        <div className="flex items-center gap-2">
          <button
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
            className="rounded-md border border-border px-2.5 py-1 text-label-sm text-ink-muted transition-colors hover:border-border-strong hover:text-ink disabled:opacity-40"
          >
            Previous
          </button>
          <span className="tnum text-label-sm text-ink">
            Page {current + 1} of {pages}
          </span>
          <button
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
            className="rounded-md border border-border px-2.5 py-1 text-label-sm text-ink-muted transition-colors hover:border-border-strong hover:text-ink disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
