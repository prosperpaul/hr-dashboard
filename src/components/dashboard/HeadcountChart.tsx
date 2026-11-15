"use client";

import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Pill } from "./Panel";

// One month of history: headcount at month end + people who joined that month.
export type HeadcountPoint = { month: string; label: string; headcount: number; hires: number };

const PERIODS = [
  { key: "3M", months: 3 },
  { key: "6M", months: 6 },
  { key: "12M", months: 12 },
] as const;

// Hover tooltip, styled as a "Level 2" popover from the design system.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p: HeadcountPoint = payload[0].payload;
  return (
    <div className="rounded-lg border border-border-strong bg-surface-2 px-3 py-2 shadow-popover">
      <div className="flex items-center justify-between gap-4 text-label-sm">
        <span className="uppercase tracking-wider text-ink-faint">{p.label}</span>
        {p.hires > 0 && <span className="text-accent-hover">+{p.hires} joined</span>}
      </div>
      <p className="mt-0.5 text-body-sm text-ink-faint">
        <span className="tnum text-headline-sm text-ink">{p.headcount}</span> team members
      </p>
    </div>
  );
}

// "+30 (+25.4%)" style growth text.
function growthText(from: number, to: number): { text: string; pct: string | null } {
  const diff = to - from;
  const sign = diff >= 0 ? "+" : "−";
  const pct = from > 0 ? `${sign}${Math.abs(Math.round((diff / from) * 1000) / 10)}%` : null;
  return { text: `${sign}${Math.abs(diff)}`, pct };
}

/*
  The whole "Headcount Growth" card. It's a Client Component because the
  3M / 6M / 12M toggle needs state. The server sends all 12 months once;
  switching period just slices that array — no extra database calls.
*/
export default function HeadcountChart({ data }: { data: HeadcountPoint[] }) {
  const [months, setMonths] = useState<number>(12);
  const shown = data.slice(-months);

  // Growth across the chosen window: compare the month BEFORE the window
  // (if we have it) with the last month, so 3M means "change over 3 months".
  const start = data[data.length - months - 1]?.headcount ?? shown[0]?.headcount ?? 0;
  const end = shown[shown.length - 1]?.headcount ?? 0;
  const growth = growthText(start, end);
  const hires = shown.reduce((sum, p) => sum + p.hires, 0);
  const avgHires = shown.length ? Math.round((hires / shown.length) * 10) / 10 : 0;

  const summary = [
    { label: "Net growth", value: growth.pct ? `${growth.text} (${growth.pct})` : growth.text, accent: true },
    { label: "Avg monthly hires", value: `${avgHires} / mo` },
    { label: `Hires (${months}M)`, value: String(hires) },
    { label: "Current headcount", value: String(end) },
  ];

  return (
    <section className="rounded-xl border border-border bg-surface p-5 transition-colors duration-150 hover:border-border-strong">
      {/* Header + period toggle */}
      <div className="flex flex-col justify-between gap-3 border-b border-border pb-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-headline-md text-ink">Headcount Growth</h2>
            {growth.pct && <Pill tone="accent">{growth.pct}</Pill>}
          </div>
          <p className="mt-0.5 text-body-sm text-ink-faint">Total team size over the last {months} months</p>
        </div>

        <div className="inline-flex self-start rounded-lg border border-border bg-bg p-0.5 sm:self-auto" role="group" aria-label="Time period">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setMonths(p.months)}
              aria-pressed={months === p.months}
              className={[
                "rounded-md px-2.5 py-1 text-label-sm transition-colors",
                months === p.months ? "bg-surface-2 text-accent-hover" : "text-ink-faint hover:text-ink",
              ].join(" ")}
            >
              {p.key}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="h-72 w-full pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={shown} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="headcountFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.15} />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--color-ink-faint)", fontSize: 11 }}
              dy={6}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={40}
              allowDecimals={false}
              domain={["dataMin - 2", "dataMax + 2"]}
              tick={{ fill: "var(--color-ink-faint)", fontSize: 11 }}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: "var(--color-border-strong)", strokeWidth: 1, strokeDasharray: "3 3" }}
            />
            <Area
              type="monotone"
              dataKey="headcount"
              stroke="var(--color-accent)"
              strokeWidth={2}
              fill="url(#headcountFill)"
              dot={{ r: 2.5, fill: "var(--color-surface)", stroke: "var(--color-accent)", strokeWidth: 1.5 }}
              activeDot={{ r: 4.5, fill: "var(--color-accent)", stroke: "var(--color-surface)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Summary strip */}
      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
        {summary.map((s) => (
          <div key={s.label}>
            <p className="text-label-sm uppercase tracking-wider text-ink-faint">{s.label}</p>
            <p className={`tnum mt-1 text-headline-sm font-medium ${s.accent ? "text-accent-hover" : "text-ink"}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
