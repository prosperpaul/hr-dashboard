"use client";

import { Receipt } from "lucide-react";
import { DEDUCTION_RATE, formatMoney, payDateOf, periodLabel, type MyPayslipRow } from "@/lib/payroll";

const caps = "text-[11px] font-bold uppercase tracking-[0.06em]";
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
    <div className="space-y-6">
      <div className="space-y-2">
        <p className={`flex items-center gap-2 ${caps} text-ink-muted`}>
          <span className="h-1.5 w-1.5 rounded-full bg-ink" />
          Payroll · My payslips
        </p>
        <h1 className="text-headline-lg text-ink md:text-headline-xl">{latest ? `Your ${periodLabel(latest.period)} payslip.` : "My payslips."}</h1>
        <p className="text-body-md text-ink-muted">Your finalized pay for each period, in Naira (₦).</p>
      </div>

      {!latest ? (
        <div className="grid place-items-center rounded-xl border border-border bg-surface py-16 text-center">
          <div className="max-w-sm">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface-2">
              <Receipt className="h-5 w-5 text-ink-faint" />
            </div>
            <p className="mt-3 font-display text-headline-sm text-ink">No payslips yet</p>
            <p className="mt-1 text-body-md text-ink-muted">Once payroll is finalized for a period, your payslip will appear here.</p>
          </div>
        </div>
      ) : (
        <>
          {/* Navy hero: latest take-home pay */}
          <section className="flex flex-col gap-6 rounded-xl bg-navy p-6 text-on-navy md:flex-row md:items-end md:justify-between md:p-8">
            <div className="min-w-0">
              <p className={`flex items-center gap-2 ${caps} text-on-navy-muted`}>
                <span className="h-1.5 w-1.5 rounded-full bg-[#f5c518]" />
                Net take-home · {periodLabel(latest.period)}
              </p>
              <p className="tnum mt-2 break-words font-display text-[40px] font-bold leading-[44px] tracking-[-0.02em] md:text-[52px] md:leading-[56px]">
                {formatMoney(latest.net)}
              </p>
              <p className="mt-2 text-body-sm text-on-navy-muted">{latestPayday ? `Paid ${shortDate(latestPayday)}` : latest.period}</p>
            </div>
            <dl className="grid shrink-0 grid-cols-3 gap-6 border-t border-navy-line pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
              <div>
                <dt className="text-body-sm text-on-navy-muted">Gross</dt>
                <dd className="tnum font-display text-headline-sm">{formatMoney(latest.gross)}</dd>
              </div>
              <div>
                <dt className="text-body-sm text-on-navy-muted">Deductions</dt>
                <dd className="tnum font-display text-headline-sm">−{formatMoney(latest.deductions)}</dd>
              </div>
              <div>
                <dt className="text-body-sm text-on-navy-muted">Net in {year}</dt>
                <dd className="tnum font-display text-headline-sm text-[#f5c518]">{formatMoney(ytd)}</dd>
              </div>
            </dl>
          </section>

          {/* Every payslip as a table */}
          <section className="overflow-hidden rounded-xl border border-border bg-surface">
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-display text-headline-sm text-ink">Payslip history</h2>
              <p className="text-body-sm text-ink-muted">Deductions are tax &amp; statutory, estimated at {Math.round(DEDUCTION_RATE * 100)}% of gross.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-[13px] leading-[18px]">
                <thead>
                  <tr className={`border-b border-border bg-bg ${caps} text-ink-muted`}>
                    <th className="px-5 py-3">Pay period</th>
                    <th className="px-4 py-3 text-right">Gross</th>
                    <th className="px-4 py-3 text-right">Deductions</th>
                    <th className="px-5 py-3 text-right">Net pay</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((p) => {
                    const pd = payDateOf(p.period);
                    return (
                      <tr key={p.id} className="h-14 border-b border-border last:border-0 hover:bg-bg">
                        <td className="px-5 py-2.5">
                          <p className="font-semibold text-ink">{periodLabel(p.period)}</p>
                          <p className="text-body-sm text-ink-muted">{pd ? `Paid ${shortDate(pd)}` : p.period}</p>
                        </td>
                        <td className="tnum px-4 py-2.5 text-right text-ink">{formatMoney(p.gross)}</td>
                        <td className="tnum px-4 py-2.5 text-right text-critical">−{formatMoney(p.deductions)}</td>
                        <td className="tnum px-5 py-2.5 text-right font-semibold text-ink">{formatMoney(p.net)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
