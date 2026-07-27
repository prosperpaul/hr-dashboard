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

// "$4,167" — currency formatting (USD, no cents).
export function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
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
