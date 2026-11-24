"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";

// One month of history: headcount at month end + people who joined that month.
export type HeadcountPoint = { month: string; label: string; headcount: number; hires: number };

const PERIODS = [3, 6, 12] as const;

// The chart (and the heavy recharts library) loads separately, after the
// page is on screen. Until then a soft placeholder fills the same box, so
// nothing jumps (the `!` makes its fill navy instead of the usual grey).
// `ssr: false` = don't try to draw it on the server.
const HeroChart = dynamic(() => import("./HeroChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full bg-navy-2!" />,
});

/*
  The navy "hero" band at the top of the Overview.

  Left: the big headcount number and a year-on-year comparison box.
  Right: the headcount trajectory chart with a 3M / 6M / 12M switch.

  It's a Client Component only because of that switch (it needs state).
  The server sends all 12 months once; switching just slices the array.

  The white tag on the chart marks the month with the most new joiners
  in the visible window — calculated from real start dates, not made up.

  Phones: tighter padding, a slightly smaller number and a shorter chart so
  the band doesn't eat the whole first screen.
*/
export default function HeroBand({
  total,
  teams,
  joinedThisMonth,
  history,
}: {
  total: number;
  teams: number;
  joinedThisMonth: number;
  history: HeadcountPoint[]; // last 12 months, oldest first
}) {
  const [months, setMonths] = useState<number>(12);
  const shown = history.slice(-months);

  // Year-on-year: the month 12 months back vs now.
  const yearAgo = history[0]?.headcount ?? 0;
  const yoyDiff = total - yearAgo;
  const yoyPct = yearAgo > 0 ? Math.round((yoyDiff / yearAgo) * 1000) / 10 : null;

  // Busiest hiring month in the visible window (only worth tagging if 2+ joined).
  const peak = shown.reduce<HeadcountPoint | null>((best, p) => (p.hires >= 2 && p.hires > (best?.hires ?? 0) ? p : best), null);
  const last = shown[shown.length - 1];

  return (
    <section className="rounded-xl bg-navy p-5 text-on-navy md:p-6 lg:p-10">
      <div className="grid grid-cols-1 items-center gap-6 md:gap-10 lg:grid-cols-12">
        {/* ── Left: the big number ── */}
        <div className="space-y-4 md:space-y-6 lg:col-span-5">
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-eyebrow uppercase text-accent">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Total active personnel
            </p>
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="tnum font-display text-metric-lg font-bold leading-none tracking-[-0.03em] sm:text-[56px] md:text-[64px]">{total}</span>
              <span className="font-display text-metric-lg font-bold leading-none tracking-[-0.03em] sm:text-[56px] md:text-[64px]">{total === 1 ? "person" : "people"}</span>
            </p>
            <p className="text-body-md text-on-navy-muted">
              Across {teams} {teams === 1 ? "team" : "teams"} ·{" "}
              <span className="font-medium text-on-navy">
                {joinedThisMonth} joined this month
              </span>
            </p>
          </div>

          {/* Year-on-year box (tablet/desktop; phones get a one-line version under the chart) */}
          <div className="hidden space-y-1 rounded-lg bg-navy-2 p-4 md:block">
            <div className="flex items-center justify-between gap-3">
              <span className="text-eyebrow uppercase text-accent">Year on year</span>
              <span className="tnum text-body-md font-semibold">
                {yearAgo} → {total}
              </span>
            </div>
            <p className="text-body-sm text-on-navy-muted">
              {yoyDiff === 0 ? (
                "Same size as twelve months ago"
              ) : (
                <>
                  <span className="font-medium text-accent">
                    {yoyDiff > 0 ? "+" : "−"}
                    {Math.abs(yoyDiff)}
                    {yoyPct !== null && ` (${yoyDiff > 0 ? "+" : "−"}${Math.abs(yoyPct)}%)`}
                  </span>{" "}
                  people compared with twelve months ago
                </>
              )}
            </p>
          </div>
        </div>

        {/* ── Right: trajectory chart ── */}
        <div className="min-w-0 space-y-3 md:space-y-4 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="hidden md:block">
              <p className="text-eyebrow uppercase text-on-navy-muted">Trajectory</p>
              <h2 className="font-display text-headline-sm">{months}-Month Headcount</h2>
            </div>
            {/* Period switch: 48px-tall pills on phones/tablets (thumb), compact on desktop.
                On phones the heading beside it is hidden, so the pills sit on the right. */}
            <div className="ml-auto inline-flex items-center gap-1 rounded-full bg-navy-2 p-1" role="group" aria-label="Time period">
              {PERIODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonths(m)}
                  aria-pressed={months === m}
                  className={[
                    "min-h-tap min-w-tap rounded-full px-3 text-eyebrow transition-colors lg:min-h-0 lg:min-w-0 lg:py-1",
                    months === m ? "bg-accent text-on-accent" : "text-on-navy-muted hover:text-on-navy",
                  ].join(" ")}
                >
                  {m}M
                </button>
              ))}
            </div>
          </div>

          <div className="h-48 min-h-48 w-full md:h-56">
            <HeroChart data={shown} peak={peak} />
          </div>
          {/* Phones: the year-on-year change as one short line (mobile mockup) */}
          <p className="flex items-center gap-2 text-body-md text-on-navy md:hidden">
            {yoyDiff >= 0 ? <TrendingUp className="h-4 w-4 text-accent" aria-hidden /> : <TrendingDown className="h-4 w-4 text-accent" aria-hidden />}
            {yoyDiff === 0
              ? "Same size as a year ago"
              : `${yoyDiff > 0 ? "Up" : "Down"} ${yoyPct !== null ? `${Math.abs(yoyPct)}%` : Math.abs(yoyDiff)} on a year ago (${yearAgo} → ${total})`}
          </p>
          {last && (
            <p className="hidden text-right text-body-sm text-on-navy-muted md:block">
              <span className="font-semibold text-on-navy">
                {last.label} ({last.headcount})
              </span>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
