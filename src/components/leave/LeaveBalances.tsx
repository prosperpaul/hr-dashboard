"use client";

import { useState } from "react";
import { Search, ArrowRight } from "lucide-react";
import { formatLeaveRange, leaveStyle, type LeaveRow } from "@/lib/leave";
import { deptBadgeClass } from "@/lib/dept-tint";
import ResponsiveList from "@/components/ui/ResponsiveList";
import ListRow from "@/components/ui/ListRow";
import StatusText from "@/components/ui/StatusText";
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
// A table from md up; on phones each person is one row (name + remaining/used).
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

  const isLow = (r: BalanceRow) => r.allowance > 0 && r.remaining / r.allowance < 0.25; // under a quarter left
  const upcomingChip = (r: BalanceRow) =>
    r.upcoming ? (
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
    );

  const pagerButton =
    "min-h-tap flex-1 rounded-full border border-border bg-surface px-4 text-label-sm text-ink transition-colors hover:bg-bg disabled:opacity-40 sm:flex-none lg:h-8 lg:min-h-0 md:px-3";

  return (
    <section id="balances" className="scroll-mt-24 overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex flex-col justify-between gap-3 border-b border-border p-4 sm:flex-row sm:items-center md:p-5">
        <div className="min-w-0">
          <p className="text-eyebrow uppercase text-ink-muted">Allowances</p>
          <h2 className="text-headline-md text-ink">Leave balances</h2>
          <p className="text-body-sm text-ink-muted">
            Paid allowance for {year} · Vacation &amp; Personal count against it, Sick &amp; Unpaid don&apos;t
          </p>
        </div>
        <div className="relative sm:w-64">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            aria-label="Filter employees"
            autoComplete="off"
            placeholder="Filter employees…"
            className="min-h-tap w-full rounded-full border border-border bg-surface pl-9 pr-3 text-body-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-ink focus:ring-1 focus:ring-ink lg:h-9 lg:min-h-0 md:pl-8"
          />
        </div>
      </div>

      <ResponsiveList
        caption={`Leave balances for ${year}`}
        rows={visible}
        getKey={(r) => r.id}
        // Pad the table inside the card (its first/last cells have no side padding).
        tableClassName="md:px-5 [&_table]:text-body-sm"
        listClassName="px-4"
        empty={<p className="py-10 text-center text-body-md text-ink-muted">No matching employees.</p>}
        columns={[
          {
            key: "employee",
            header: "Employee",
            cell: (r) => (
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar name={r.name} department={r.department} size={30} />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{r.name}</p>
                  <p className="truncate text-body-sm text-ink-muted">{r.email}</p>
                </div>
              </div>
            ),
          },
          {
            key: "department",
            header: "Department",
            cell: (r) => (r.department ? <span className={deptBadgeClass(r.department)}>{r.department}</span> : <span className="text-ink-muted">—</span>),
          },
          {
            key: "entitlement",
            header: "Entitlement",
            className: "tnum hidden text-ink-muted lg:table-cell",
            headerClassName: "hidden lg:table-cell",
            cell: (r) => `${r.allowance} days / yr`,
          },
          {
            key: "used",
            header: "Days used",
            cell: (r) => {
              const usedPct = r.allowance ? Math.min(100, (r.used / r.allowance) * 100) : 0;
              return (
                <div className="flex items-center gap-2">
                  <span className="tnum w-9 text-ink">{r.used}d</span>
                  <span aria-hidden className="block h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                    <span className={`block h-full rounded-full ${isLow(r) ? "bg-warning" : "bg-navy"}`} style={{ width: `${usedPct}%` }} />
                  </span>
                </div>
              );
            },
          },
          {
            key: "remaining",
            header: "Remaining",
            cell: (r) => (
              <span className={`tnum font-medium ${isLow(r) ? "text-warning" : "text-ink"}`}>
                {r.remaining} {r.remaining === 1 ? "day" : "days"}
              </span>
            ),
          },
          { key: "upcoming", header: "Upcoming", cell: upcomingChip },
        ]}
        renderRow={(r) => (
          <ListRow
            leading={<Avatar name={r.name} department={r.department} size={40} />}
            title={r.name}
            subtitle={`${r.used} of ${r.allowance}d used · ${r.department ?? "No department"}`}
            meta={
              <span className={`font-semibold ${isLow(r) ? "text-warning" : "text-ink"}`}>
                {r.remaining} {r.remaining === 1 ? "day" : "days"} left
              </span>
            }
            // "Low" in words too, so the warning isn't colour-only.
            trailing={isLow(r) ? <StatusText tone="warning">Low balance</StatusText> : undefined}
          />
        )}
      />

      <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-body-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between md:px-5">
        <span>
          Showing <span className="tnum text-ink">{visible.length}</span> of <span className="tnum text-ink">{filtered.length}</span> employees
        </span>
        <div className="flex items-center gap-2">
          <button disabled={current === 0} onClick={() => setPage(current - 1)} className={pagerButton}>
            Previous
          </button>
          <span className="tnum shrink-0 text-label-sm text-ink">
            Page {current + 1} of {pages}
          </span>
          <button disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className={pagerButton}>
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
    <section className="rounded-xl border border-border bg-surface p-4 md:p-5">
      <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
        <div className="min-w-0">
          <p className="text-eyebrow uppercase text-ink-muted">{eyebrow}</p>
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
              <div aria-hidden className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                <div className={`h-full rounded-full ${it.warn ? "bg-warning" : "bg-navy"}`} style={{ width: `${Math.max(0, Math.min(100, it.pct))}%` }} />
              </div>
            )}
            {it.note && <p className="mt-1.5 text-body-sm text-ink-muted">{it.note}</p>}
          </div>
        ))}
      </div>

      {linkHref && linkLabel && (
        // 48px tall on phones so it's an easy tap; the original compact link from md up
        <a
          href={linkHref}
          className="mt-4 flex min-h-tap items-center justify-between border-t border-border text-label-md font-semibold text-ink hover:underline md:mt-5 lg:min-h-0 md:pt-4"
        >
          {linkLabel}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </a>
      )}
    </section>
  );
}
