"use client";

import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

// A dashboard stat. Trend fields are optional — we only show a delta/sparkline
// when we actually have the data to back them up (no fabricated trends).
export type DashStat = {
  key: string;
  label: string;
  value: string;
  deltaPct?: number | null; // % change vs last period (null = don't show)
  upIsGood?: boolean; // does an increase mean improvement?
  spark?: number[]; // tiny trend line (omit to hide)
  hint?: string; // small caption shown when there's no delta
};

export default function StatCard({ stat }: { stat: DashStat }) {
  const hasDelta = stat.deltaPct !== null && stat.deltaPct !== undefined;
  const wentUp = (stat.deltaPct ?? 0) >= 0;
  const goodOutcome = wentUp === (stat.upIsGood ?? true);
  const trendColor = goodOutcome ? "var(--color-good)" : "var(--color-critical)";
  const Arrow = wentUp ? ArrowUpRight : ArrowDownRight;
  const sparkData = (stat.spark ?? []).map((v) => ({ v }));

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent/40">
      <p className="text-sm text-ink-muted">{stat.label}</p>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-ink">{stat.value}</p>

          {hasDelta ? (
            <div className="mt-1.5 flex items-center gap-1 text-xs font-medium" style={{ color: trendColor }}>
              <Arrow className="h-3.5 w-3.5" />
              <span>{Math.abs(stat.deltaPct as number)}%</span>
              <span className="text-ink-faint font-normal">vs last month</span>
            </div>
          ) : (
            stat.hint && <p className="mt-1.5 text-xs text-ink-faint">{stat.hint}</p>
          )}
        </div>

        {sparkData.length > 0 && (
          <div className="h-10 w-24">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={trendColor}
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
