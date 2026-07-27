"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
export type DeptPoint = { department: string; employees: number };

function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-ink">{row.department}</p>
      <p className="mt-0.5 text-ink-muted">{row.employees} employees</p>
    </div>
  );
}

export default function DepartmentChart({ data }: { data: DeptPoint[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-muted">No departments yet.</p>;
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 12, bottom: 0, left: 8 }}
          barCategoryGap={10}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="department"
            tickLine={false}
            axisLine={false}
            width={84}
            tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-surface-2)" }} />
          <Bar dataKey="employees" radius={[0, 4, 4, 0]} maxBarSize={22}>
            {data.map((d) => (
              <Cell key={d.department} fill="var(--color-accent)" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
