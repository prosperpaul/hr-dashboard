"use client";

import { Receipt } from "lucide-react";
import { DEDUCTION_RATE, formatMoney, payDateOf, periodLabel, type MyPayslipRow } from "@/lib/payroll";
import PageHeader from "@/components/ui/PageHeader";
import ResponsiveList from "@/components/ui/ResponsiveList";
import ListRow from "@/components/ui/ListRow";
import EmptyState from "@/components/ui/EmptyState";

const caps = "text-eyebrow uppercase";
const shortDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// Self-service view: an employee's own finalized payslips (amounts in ₦).
export default function MyPayslips({ payslips }: { payslips: MyPayslipRow[] }) {
  // Newest period first, so [0] is the latest payslip.
  const sorted = [...payslips].sort((a, b) => b.period.localeCompare(a.period));
  const latest = sorted[0];
  // Year-to-date: everything paid in the same calendar year as the latest slip.
  const year = latest?.period.slice(0, 4);
  const ytd = sorted.filter((p) => p.period.startsWith(year ?? "")).reduce((s, p) => s + p.net, 0);
  const latestPayday = latest ? payDateOf(latest.period) : null;

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        className="mb-0! md:mb-0!"
        eyebrow="Payroll · My payslips"
        title={latest ? `Your ${periodLabel(latest.period)} payslip.` : "My payslips."}
        description="Your finalized pay for each period, in Naira (₦)."
      />

      {!latest ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState icon={Receipt} title="No payslips yet" description="Once payroll is finalized for a period, your payslip will appear here." />
        </div>
      ) : (
        <>
          {/* Navy hero: latest take-home pay */}
          <section className="flex min-w-0 flex-col gap-6 rounded-xl bg-navy p-5 text-on-navy md:flex-row md:items-end md:justify-between md:p-8">
            <div className="min-w-0">
              <p className={`flex items-center gap-2 ${caps} text-on-navy-muted`}>
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                Net take-home · {periodLabel(latest.period)}
              </p>
              <p className="tnum mt-2 font-display text-[32px] font-bold leading-[38px] tracking-[-0.02em] [overflow-wrap:anywhere] sm:text-[40px] sm:leading-[44px] md:text-[52px] md:leading-[56px]">
                {formatMoney(latest.net)}
              </p>
              <p className="mt-2 text-body-sm text-on-navy-muted">{latestPayday ? `Paid ${shortDate(latestPayday)}` : latest.period}</p>
            </div>
            {/* Phones: three label/amount lines (three Naira figures don't fit
                side by side at 360px). sm and up: three columns as before. */}
            <dl className="grid min-w-0 shrink-0 grid-cols-1 gap-3 border-t border-navy-line pt-4 sm:grid-cols-3 sm:gap-6 md:border-l md:border-t-0 md:pl-6 md:pt-0">
              <div className="flex items-baseline justify-between gap-3 sm:block">
                <dt className="text-body-sm text-on-navy-muted">Gross</dt>
                <dd className="tnum font-display text-headline-sm">{formatMoney(latest.gross)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 sm:block">
                <dt className="text-body-sm text-on-navy-muted">Deductions</dt>
                <dd className="tnum font-display text-headline-sm">−{formatMoney(latest.deductions)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 sm:block">
                <dt className="text-body-sm text-on-navy-muted">Net in {year}</dt>
                <dd className="tnum font-display text-headline-sm text-accent">{formatMoney(ytd)}</dd>
              </div>
            </dl>
          </section>

          {/* Every payslip: a table from md up, a list of rows on phones */}
          <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface">
            <div className="border-b border-border px-4 py-4 md:px-5">
              <h2 className="font-display text-headline-sm text-ink">Payslip history</h2>
              <p className="text-body-sm text-ink-muted">Deductions are tax &amp; statutory, estimated at {Math.round(DEDUCTION_RATE * 100)}% of gross.</p>
            </div>
            <ResponsiveList
              inset
              caption="Payslip history"
              rows={sorted}
              getKey={(p) => p.id}
              listClassName="px-4"
              columns={[
                {
                  key: "period",
                  header: "Pay period",
                  cell: (p) => {
                    const pd = payDateOf(p.period);
                    return (
                      <>
                        <p className="font-semibold text-ink">{periodLabel(p.period)}</p>
                        <p className="text-body-sm text-ink-muted">{pd ? `Paid ${shortDate(pd)}` : p.period}</p>
                      </>
                    );
                  },
                },
                { key: "gross", header: "Gross", align: "right", className: "tnum whitespace-nowrap text-ink", cell: (p) => formatMoney(p.gross) },
                { key: "deductions", header: "Deductions", align: "right", className: "tnum whitespace-nowrap text-critical", cell: (p) => `−${formatMoney(p.deductions)}` },
                { key: "net", header: "Net pay", align: "right", className: "tnum whitespace-nowrap font-semibold text-ink", cell: (p) => formatMoney(p.net) },
              ]}
              renderRow={(p) => {
                const pd = payDateOf(p.period);
                return (
                  <ListRow
                    title={periodLabel(p.period)}
                    subtitle={<span className="tnum">{`${pd ? `Paid ${shortDate(pd)}` : p.period} · Gross ${formatMoney(p.gross)}`}</span>}
                    meta={<span className="font-semibold">{formatMoney(p.net)}</span>}
                    trailing={<span className="tnum truncate text-body-sm text-critical">−{formatMoney(p.deductions)}</span>}
                  />
                );
              }}
            />
          </section>
        </>
      )}
    </div>
  );
}
