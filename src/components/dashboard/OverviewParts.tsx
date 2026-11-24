import Link from "next/link";
import { ArrowRight, CalendarDays, PartyPopper } from "lucide-react";
import { deptTint, deptBadgeClass } from "@/lib/dept-tint";
import ListRow from "@/components/ui/ListRow";

/*
  The smaller building blocks of the Overview page (all Server Components —
  they just display what the page hands them, no interactivity).
*/

// Small all-caps label used across the page ("label-caps" in the design).
export function Caps({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`text-eyebrow uppercase ${className}`}>{children}</span>;
}

function Avatar({ initials, department, size = "h-10 w-10 text-[14px]" }: { initials: string; department?: string | null; size?: string }) {
  return (
    <div className={`font-display grid shrink-0 place-items-center rounded-full font-bold text-ink ${size} ${deptTint(department)}`}>
      {initials}
    </div>
  );
}

// ── Who's out this week ─────────────────────────────────────────────
export type OutRow = {
  id: string;
  name: string;
  initials: string;
  department: string | null;
  type: string; // Vacation, Sick…
  range: string; // "Nov 17–18"
  returnsTomorrow: boolean; // leave ends today
};

export function OutThisWeek({ rows }: { rows: OutRow[] }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4 md:p-6">
      <div className="mb-4 flex md:mb-5 items-center justify-between gap-3">
        <h2 className="text-headline-sm text-ink">Who&apos;s out this week</h2>
        <Caps className="text-ink-muted">
          {rows.length} {rows.length === 1 ? "record" : "records"}
        </Caps>
      </div>

      {rows.length === 0 ? (
        <p className="py-4 text-body-md text-ink-muted">Everyone&apos;s in this week.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id} className="flex min-w-0 items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar initials={r.initials} department={r.department} />
                <div className="min-w-0">
                  <p className="truncate text-label-md text-ink">{r.name}</p>
                  <p className="truncate text-body-sm text-ink-muted">{r.department ?? "—"}</p>
                </div>
              </div>
              {r.returnsTomorrow ? (
                <span className="shrink-0 rounded-full bg-good/15 px-2.5 py-1 text-eyebrow text-good">
                  Back tomorrow
                </span>
              ) : (
                <span
                  className={`tnum shrink-0 rounded-full px-2.5 py-1 text-right text-eyebrow text-ink ${
                    r.type === "Sick" ? "bg-tint-rose" : "bg-surface-2"
                  }`}
                >
                  {r.range} {r.type}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── Celebrations (work anniversaries) ───────────────────────────────
export type Celebration = { id: string; name: string; years: number; when: string };

export function Celebrations({ items }: { items: Celebration[] }) {
  return (
    <section className="rounded-xl border border-accent/40 bg-accent-soft p-4 md:p-6">
      <div className="flex items-center justify-between gap-3 border-b border-accent/40 pb-3">
        <h2 className="flex items-center gap-2 text-headline-sm text-ink">
          <PartyPopper className="h-[18px] w-[18px] text-accent-ink" aria-hidden />
          Celebrations
        </h2>
        <Caps className="text-accent-ink">Next 30 days</Caps>
      </div>
      <Caps className="mt-4 block text-accent-ink">Work anniversaries</Caps>
      {items.length === 0 ? (
        <p className="mt-2 text-body-md text-ink-muted">None coming up this month.</p>
      ) : (
        <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((c) => (
            <li key={c.id} className="min-w-0 rounded-lg border border-accent/30 bg-surface px-3 py-2">
              <p className="truncate text-label-md text-ink">{c.name}</p>
              <p className="tnum truncate text-body-sm text-ink-muted">
                {c.years} {c.years === 1 ? "yr" : "yrs"} · {c.when}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ── New faces ───────────────────────────────────────────────────────
export type Face = {
  id: string;
  name: string;
  initials: string;
  role: string;
  department: string | null;
  joined: string; // "3d ago"
  startDate: string; // "Nov 4, 2026"
};

export function NewFaces({ faces, recent, total }: { faces: Face[]; recent: boolean; total: number }) {
  return (
    <section className="space-y-3 md:space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 md:items-baseline">
        <div className="flex flex-wrap items-baseline gap-3">
          <h2 className="text-headline-md text-ink">New faces</h2>
          <span className="text-body-md text-ink-muted">
            {recent ? "Welcomed over the past 30 days" : "Our most recent arrivals"}
          </span>
        </div>
        {/* min-h-tap: the link is a full 48px tall on phones, compact from lg */}
        <Link
          href="/employees"
          className="group inline-flex min-h-tap items-center gap-1.5 text-label-md text-ink underline-offset-4 hover:underline lg:min-h-0"
        >
          View all {total} employees
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </div>

      {faces.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface p-6 text-body-md text-ink-muted">No employees yet.</p>
      ) : (
        <>
        {/* Phones: one compact card of list rows (a big card per person
            would fill two screens). md+: the three editorial cards. */}
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface px-4 md:hidden">
          {faces.map((f) => (
            <li key={f.id}>
              <ListRow
                leading={<Avatar initials={f.initials} department={f.department} />}
                title={f.name}
                subtitle={f.department ? `${f.role} · ${f.department}` : f.role}
                meta={<span className="text-ink-muted">Joined {f.joined}</span>}
              />
            </li>
          ))}
        </ul>
        <div className="hidden grid-cols-3 gap-4 md:grid">
          {faces.map((f) => (
            <article key={f.id} className="flex flex-col rounded-xl border border-border bg-surface p-6">
              <div className="flex items-start justify-between gap-3">
                <div className={`font-display grid h-14 w-14 place-items-center rounded-lg text-[20px] font-bold text-ink ${deptTint(f.department)}`}>
                  {f.initials}
                </div>
                {f.department && <span className={deptBadgeClass(f.department)}>{f.department}</span>}
              </div>
              <h3 className="mt-5 text-headline-sm text-ink">{f.name}</h3>
              <p className="text-label-md text-accent-ink">{f.role}</p>
              <p className="mt-3 flex-1 text-body-md text-ink-muted">Joined the team {f.joined}.</p>
              <p className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-ink-muted">
                <CalendarDays className="h-4 w-4" aria-hidden />
                <Caps>Started {f.startDate}</Caps>
              </p>
            </article>
          ))}
        </div>
        </>
      )}
    </section>
  );
}

// ── Across the company (department split) ───────────────────────────
export type DeptShare = { department: string; employees: number };

// Soft pastel tints for the split bar (the design system's category tints,
// a touch deeper so neighbouring segments stay distinguishable).
const SEGMENT_COLORS = ["#cfe2fb", "#f9d9c9", "#f6cfd6", "#ebe0cf", "#dcd8ec", "#d3d8e2", "#fbe9a6", "#cde8dc"];

export function AcrossCompany({
  departments,
  assigned,
  statusLine,
}: {
  departments: DeptShare[]; // largest first
  assigned: number;
  statusLine: string; // e.g. "Active: 16 · On leave: 2 · Remote: 4"
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-headline-md text-ink">Across the company</h2>
            <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-eyebrow uppercase text-ink-muted">
              {departments.length} {departments.length === 1 ? "department" : "departments"}
            </span>
          </div>
          <p className="mt-1 text-body-md text-ink-muted">
            How {assigned} assigned {assigned === 1 ? "person is" : "people are"} spread across departments
          </p>
        </div>
        <p className="tnum text-body-sm text-ink-muted">{statusLine}</p>
      </div>

      {departments.length === 0 ? (
        <p className="mt-6 text-body-md text-ink-muted">No one is assigned to a department yet.</p>
      ) : (
        <>
          {/* One bar, one segment per department, width = share of people */}
          <div className="mt-6 flex h-6 w-full md:mt-8 gap-0.5 overflow-hidden rounded" role="img" aria-label="Department split">
            {departments.map((d, i) => (
              <div
                key={d.department}
                title={`${d.department}: ${d.employees}`}
                style={{ flexGrow: d.employees, backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
              />
            ))}
          </div>

          <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-10">
            {departments.map((d, i) => (
              <li key={d.department} className="min-w-0">
                <p className="flex items-center gap-2 truncate text-ink-muted">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />
                  <Caps className="truncate">{d.department}</Caps>
                </p>
                <p className="tnum mt-1 flex items-baseline gap-1.5">
                  <span className="font-display text-[22px] font-semibold text-ink">{d.employees}</span>
                  <span className="text-body-sm text-ink-muted">{Math.round((d.employees / assigned) * 100)}%</span>
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
