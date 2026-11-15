/*
  Shared payroll constants, types, and helpers. Pure (no server imports).
*/

export const PAYRUN_STATUSES = ["Draft", "Finalized"] as const;
export type PayRunStatus = (typeof PAYRUN_STATUSES)[number];

// Flat deduction rate used to estimate take-home pay (e.g. tax). A real system
// would model tax brackets, benefits, etc. — this is a clear MVP.
export const DEDUCTION_RATE = 0.2;

// Turn an ANNUAL salary into one month's payslip figures (whole units).
export function computePayslip(annualSalary: number): {
  gross: number;
  deductions: number;
  net: number;
} {
  const gross = Math.round(annualSalary / 12);
  const deductions = Math.round(gross * DEDUCTION_RATE);
  return { gross, deductions, net: gross - deductions };
}

/*
  Money is stored as whole NAIRA (₦). These formatters are created once and
  reused (building an Intl.NumberFormat is relatively slow).
  `narrowSymbol` forces "₦" everywhere — without it some browsers print "NGN".
*/
const nairaFormat = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
});
const nairaCompact = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  currencyDisplay: "narrowSymbol",
  notation: "compact",
  maximumFractionDigits: 1,
});

// "₦1,250,000"
export function formatMoney(n: number): string {
  return nairaFormat.format(n);
}

// "₦1.3M" — short form for big headline numbers.
export function formatMoneyCompact(n: number): string {
  return nairaCompact.format(n);
}

// "2026-07" -> "July 2026"
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period; // not in YYYY-MM form — show as typed
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

// Payday = last day of the period's month. "2026-07" -> Date(2026-07-31)
export function payDateOf(period: string): Date | null {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return null;
  return new Date(y, m, 0);
}

// An employee's salary row (Admin/HR salaries view).
export type SalaryRow = {
  employeeId: string;
  name: string;
  department: string;
  salary: number; // annual gross
};

// One payslip within a run.
export type PayslipRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  gross: number;
  deductions: number;
  net: number;
};

// A pay run with its payslips (manager view).
export type PayRunRow = {
  id: string;
  period: string;
  status: string;
  payslips: PayslipRow[];
};

// A payslip as an employee sees their own (self-service).
export type MyPayslipRow = {
  id: string;
  period: string;
  gross: number;
  deductions: number;
  net: number;
};
