"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
export type HeadcountPoint = { month: string; headcount: number };

// A small dark-themed tooltip that appears on hover.
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs shadow-lg">
      <p className="text-ink-faint">{label}</p>
      <p className="mt-0.5 font-semibold text-ink">
        {payload[0].value} employees
      </p>
    </div>
  );
}

export default function HeadcountChart({ data }: { data: HeadcountPoint[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          {/* Soft gradient fill under the line */}
          <defs>
            <linearGradient id="headcountFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--color-ink-faint)", fontSize: 12 }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={40}
            tick={{ fill: "var(--color-ink-faint)", fontSize: 12 }}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: "var(--color-accent)", strokeWidth: 1, strokeDasharray: "4 4" }}
          />
          <Area
            type="monotone"
            dataKey="headcount"
            stroke="var(--color-accent)"
            strokeWidth={2}
            fill="url(#headcountFill)"
            activeDot={{ r: 4, fill: "var(--color-accent)", stroke: "var(--color-surface)", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
