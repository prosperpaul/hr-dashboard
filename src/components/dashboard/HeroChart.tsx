"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot } from "recharts";
import type { HeadcountPoint } from "./HeroBand";

// Hover / tap tooltip: a white "overlay" card (Level 3 in the design system).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const p: HeadcountPoint = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-ink shadow-popover">
      <p className="text-eyebrow uppercase text-ink-muted">{p.label}</p>
      <p className="mt-0.5 text-body-sm text-ink-muted">
        <span className="tnum font-display text-[17px] font-semibold text-ink">{p.headcount}</span> people
        {p.hires > 0 && <span className="text-accent-ink"> · +{p.hires} joined</span>}
      </p>
    </div>
  );
}

/*
  The headcount trajectory chart inside the navy hero band.

  It lives in its own file so HeroBand can load it lazily (next/dynamic):
  recharts is a big library, and this way the rest of the page shows
  first while the chart code downloads in the background.

  The parent box sets the height (shorter on phones); ResponsiveContainer
  just fills it.
*/
export default function HeroChart({ data, peak }: { data: HeadcountPoint[]; peak: HeadcountPoint | null }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 30, right: 12, bottom: 0, left: 12 }}>
        <defs>
          <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f5c518" stopOpacity={0.22} />
            <stop offset="100%" stopColor="#f5c518" stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* minTickGap: recharts drops month labels that would sit closer than
            this many pixels, so a narrow phone shows every 2nd/3rd month
            instead of a crowded row. First and last always stay. */}
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={28}
          tick={{ fill: "var(--color-on-navy-muted)", fontSize: 12 }}
          dy={8}
        />
        <YAxis hide domain={["dataMin - 1", "dataMax + 1"]} />
        {/* The default tooltip trigger also fires on tap, so phones get it too. */}
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
              // Keep the tag from being cut off when the peak is the first month.
              const x = Math.max(2, (viewBox?.x ?? 0) - w / 2);
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
  );
}
