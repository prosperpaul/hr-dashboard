"use client";

import { Receipt } from "lucide-react";
import { formatMoney, periodLabel, type MyPayslipRow } from "@/lib/payroll";

// Self-service view: an employee's own finalized payslips (amounts in ₦).
export default function MyPayslips({ payslips }: { payslips: MyPayslipRow[] }) {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-label-sm uppercase tracking-wider text-ink-faint">Payroll</p>
        <h1 className="text-headline-lg text-ink md:text-headline-xl">My payslips</h1>
        <p className="text-body-md text-ink-muted">Your finalized pay for each period, in Naira (₦).</p>
      </div>

      {payslips.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-border bg-surface py-16 text-center">
          <div className="max-w-sm">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-lg border border-border bg-surface-2">
              <Receipt className="h-5 w-5 text-ink-faint" />
            </div>
            <p className="mt-3 text-headline-sm text-ink">No payslips yet</p>
            <p className="mt-1 text-body-md text-ink-muted">
              Once payroll is finalized for a period, your payslip will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {payslips.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-border bg-surface p-5 transition-colors duration-150 hover:border-border-strong"
            >
              <div className="flex items-center justify-between">
                <p className="text-headline-sm text-ink">{periodLabel(p.period)}</p>
                <Receipt className="h-4 w-4 text-ink-faint" />
              </div>
              <dl className="mt-4 space-y-2 text-body-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-ink-muted">Gross</dt>
                  <dd className="tnum text-ink">{formatMoney(p.gross)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-ink-muted">Deductions</dt>
                  <dd className="tnum text-critical">−{formatMoney(p.deductions)}</dd>
                </div>
                <div className="flex items-end justify-between border-t border-border pt-3">
                  <dt className="text-label-md text-ink">Net pay</dt>
                  <dd className="tnum text-metric-md font-semibold text-accent-hover">{formatMoney(p.net)}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
