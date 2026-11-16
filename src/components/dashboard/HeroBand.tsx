"use client";

import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot } from "recharts";

// One month of history: headcount at month end + people who joined that month.
export type HeadcountPoint = { month: string; label: string; headcount: number; hires: number };

const PERIODS = [3, 6, 12] as const;

// Hover tooltip: a white "overlay" card (Level 3 in the design system).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p: HeadcountPoint = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-ink shadow-popover">
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">{p.label}</p>
      <p className="mt-0.5 text-body-sm text-ink-muted">
        <span className="tnum font-display text-[17px] font-semibold text-ink">{p.headcount}</span> people
        {p.hires > 0 && <span className="text-accent-ink"> · +{p.hires} joined</span>}
      </p>
    </div>
  );
}

/*
  The navy "hero" band at the top of the Overview.

  Left: the big headcount number and a year-on-year comparison box.
  Right: the headcount trajectory chart with a 3M / 6M / 12M switch.

  It's a Client Component only because of that switch (it needs state).
  The server sends all 12 months once; switching just slices the array.

  The white tag on the chart marks the month with the most new joiners
  in the visible window — calculated from real start dates, not made up.
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
    <section className="rounded-xl bg-navy p-6 text-on-navy lg:p-10">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
        {/* ── Left: the big number ── */}
        <div className="space-y-6 lg:col-span-5">
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.06em] text-accent">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Total active personnel
            </p>
            <p className="flex items-baseline gap-2">
              <span className="tnum font-display text-[56px] font-bold leading-none tracking-[-0.03em] md:text-[64px]">{total}</span>
              <span className="font-display text-[56px] font-bold leading-none tracking-[-0.03em] md:text-[64px]">{total === 1 ? "person" : "people"}</span>
            </p>
            <p className="text-body-md text-on-navy-muted">
              Across {teams} {teams === 1 ? "team" : "teams"} ·{" "}
              <span className="font-medium text-on-navy">
                {joinedThisMonth} joined this month
              </span>
            </p>
          </div>

          {/* Year-on-year box */}
          <div className="space-y-1 rounded-lg bg-navy-2 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-accent">Year on year</span>
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
        <div className="space-y-4 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-on-navy-muted">Trajectory</p>
              <h2 className="font-display text-[18px] font-semibold">{months}-Month Headcount</h2>
            </div>
            <div className="inline-flex items-center gap-1 rounded-full bg-navy-2 p-1" role="group" aria-label="Time period">
              {PERIODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonths(m)}
                  aria-pressed={months === m}
                  className={[
                    "rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.06em] transition-colors",
                    months === m ? "bg-accent text-on-accent" : "text-on-navy-muted hover:text-on-navy",
                  ].join(" ")}
                >
                  {m}M
                </button>
              ))}
            </div>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={shown} margin={{ top: 30, right: 12, bottom: 0, left: 12 }}>
                <defs>
                  <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f5c518" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#f5c518" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  tick={{ fill: "var(--color-on-navy-muted)", fontSize: 12 }}
                  dy={8}
                />
                <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgb(255 255 255 / 0.2)", strokeWidth: 1 }} />
                <Area
                  type="monotone"
                  dataKey="headcount"
                  stroke="#f5c518"
                  strokeWidth={2.5}
                  fill="url(#heroFill)"
                  dot={{ r: 3, fill: "var(--color-navy)", stroke: "#f5c518", strokeWidth: 2 }}
                  activeDot={{ r: 5, fill: "#f5c518", stroke: "var(--color-navy)", strokeWidth: 2 }}
                  isAnimationActive={false}
                />
                {peak && (
                  <ReferenceDot
                    x={peak.month}
                    y={peak.headcount}
                    r={0}
                    label={({ viewBox }: { viewBox?: { x?: number; y?: number } }) => {
                      const text = `${peak.hires} joined in ${peak.month}`;
                      const w = text.length * 6.6 + 16;
                      const x = (viewBox?.x ?? 0) - w / 2;
                      const y = (viewBox?.y ?? 0) - 30;
                      return (
                        <g>
                          <rect x={x} y={y} width={w} height={20} rx={3} fill="#ffffff" />
                          <text
                            x={x + w / 2}
                            y={y + 14}
                            textAnchor="middle"
                            fill="#101b3a"
                            fontSize={11}
                            fontWeight={700}
                            letterSpacing="0.04em"
                          >
                            {text}
                          </text>
                        </g>
                      );
                    }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {last && (
            <p className="text-right text-body-sm text-on-navy-muted">
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
