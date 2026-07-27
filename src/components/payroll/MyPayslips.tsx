"use client";

import { Receipt } from "lucide-react";
import { formatMoney, type MyPayslipRow } from "@/lib/payroll";

export default function MyPayslips({ payslips }: { payslips: MyPayslipRow[] }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">My payslips</h1>
        <p className="mt-1 text-sm text-ink-muted">Your finalized pay for each period</p>
      </div>

      {payslips.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-border bg-surface py-16 text-center">
          <div className="max-w-sm">
            <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-surface-2">
              <Receipt className="h-5 w-5 text-ink-faint" />
            </div>
            <p className="mt-3 text-sm font-medium text-ink">No payslips yet</p>
            <p className="mt-1 text-sm text-ink-muted">
              Once payroll is finalized for a period, your payslip will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {payslips.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <p className="text-base font-semibold text-ink">{p.period}</p>
                <Receipt className="h-4 w-4 text-ink-faint" />
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-ink-muted">Gross</dt>
                  <dd className="text-ink">{formatMoney(p.gross)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-ink-muted">Deductions</dt>
                  <dd className="text-critical">−{formatMoney(p.deductions)}</dd>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-2">
                  <dt className="font-medium text-ink">Net pay</dt>
                  <dd className="text-lg font-semibold text-ink">{formatMoney(p.net)}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
