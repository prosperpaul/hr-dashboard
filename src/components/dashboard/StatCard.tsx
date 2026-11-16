import { TrendingUp, TrendingDown } from "lucide-react";
import { Pill } from "./Panel";

/*
  One KPI card: label + badge on top, a big number with an optional
  sparkline / extra detail beside it, and a footer strip.

  Only real figures go in here — every field is optional so a card simply
  hides what we don't have data for (no fabricated trends).
*/
export type DashStat = {
  key: string;
  label: string;
  value: string;
  // Badge in the top-right corner.
  badge?: { text: string; tone?: "accent" | "neutral"; trend?: "up" | "down"; dot?: boolean };
  spark?: number[]; // tiny trend line beside the number
  side?: React.ReactNode; // anything else to show beside the number
  bar?: { value: number; className: string }[]; // stacked progress bar segments
  footer?: { label: string; value: string; accent?: boolean };
};

/*
  Draws a sparkline as plain SVG. We scale the numbers into a 96×32 box:
  x spreads points evenly left→right, y maps min→bottom and max→top.
*/
export function Sparkline({ values, id }: { values: number[]; id: string }) {
  if (values.length < 2) return null;
  const W = 96;
  const H = 32;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1; // flat line? avoid dividing by zero
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * W,
    H - 3 - ((v - min) / range) * (H - 6), // 3px breathing room top & bottom
  ]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = pts[pts.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-8 w-24 overflow-visible" fill="none" aria-hidden>
      <defs>
        {/* Butter-yellow wash under a navy ink line */}
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${W} ${H} L0 ${H} Z`} fill={`url(#${id})`} />
      <path d={line} stroke="var(--color-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="3" fill="var(--color-accent)" stroke="var(--color-ink)" strokeWidth="1.5" />
    </svg>
  );
}

export default function StatCard({ stat }: { stat: DashStat }) {
  const TrendIcon = stat.badge?.trend === "down" ? TrendingDown : TrendingUp;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex-1 p-5 md:p-6">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">{stat.label}</p>
          {stat.badge && (
            <Pill tone={stat.badge.tone ?? "accent"} dot={stat.badge.dot}>
              {stat.badge.trend && <TrendIcon className="h-3 w-3" />}
              {stat.badge.text}
            </Pill>
          )}
        </div>

        <div className="mt-4 flex items-end justify-between gap-3">
          <p className="tnum text-metric-lg text-ink">{stat.value}</p>
          {stat.spark && <Sparkline values={stat.spark} id={`spark-${stat.key}`} />}
          {stat.side}
        </div>

        {stat.bar && stat.bar.length > 0 && (
          <div className="mt-4 flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-surface-2">
            {stat.bar.map((seg, i) => (
              <div key={i} className={`h-full ${seg.className}`} style={{ flexGrow: seg.value }} />
            ))}
          </div>
        )}
      </div>

      {stat.footer && (
        <div className="flex items-center justify-between gap-2 border-t border-border px-5 py-3 md:px-6 text-body-sm">
          <span className="text-ink-faint">{stat.footer.label}</span>
          <span className={`tnum text-label-sm ${stat.footer.accent ? "text-accent-ink" : "text-ink"}`}>
            {stat.footer.value}
          </span>
        </div>
      )}
    </div>
  );
}
