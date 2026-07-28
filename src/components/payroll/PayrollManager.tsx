"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Lock, Wallet, Receipt } from "lucide-react";
import { initialsOf } from "@/lib/sample-data";
import { formatMoney, type SalaryRow, type PayRunRow } from "@/lib/payroll";
import { setSalary, createPayRun, finalizePayRun, deletePayRun } from "@/lib/payroll-actions";
import SalaryModal from "./SalaryModal";
import PayRunModal from "./PayRunModal";

function RunStatusBadge({ status }: { status: string }) {
  const cls =
    status === "Finalized"
      ? "bg-good/15 text-good ring-good/40"
      : "bg-warning/15 text-warning ring-warning/40";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cls}`}>
      {status}
    </span>
  );
}

export default function PayrollManager({
  salaries,
  payRuns,
}: {
  salaries: SalaryRow[];
  payRuns: PayRunRow[];
}) {
  const router = useRouter();
  const [editingSalary, setEditingSalary] = useState<SalaryRow | null>(null);
  const [salaryModalOpen, setSalaryModalOpen] = useState(false);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(payRuns[0]?.id ?? null);
  const [isPending, startTransition] = useTransition();

  const selectedRun = payRuns.find((r) => r.id === selectedRunId) ?? payRuns[0] ?? null;
  const totalAnnual = salaries.reduce((s, r) => s + r.salary, 0);
  const runNet = selectedRun?.payslips.reduce((s, p) => s + p.net, 0) ?? 0;

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  function handleSaveSalary(employeeId: string, salary: number) {
    run(async () => {
      await setSalary(employeeId, salary);
      setSalaryModalOpen(false);
    });
  }
  function handleCreateRun(period: string) {
    run(async () => {
      await createPayRun(period);
      setRunModalOpen(false);
    });
  }
  function handleFinalize(id: string) {
    if (!window.confirm("Finalize this pay run? It will be locked.")) return;
    run(() => finalizePayRun(id));
  }
  function handleDeleteRun(id: string, period: string) {
    if (!window.confirm(`Delete the ${period} pay run and its payslips?`)) return;
    run(() => deletePayRun(id));
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Payroll</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {isPending ? "Working…" : `Total annual payroll ${formatMoney(totalAnnual)}`}
        </p>
      </div>

      {/* ---- Salaries ---- */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-ink">Salaries</h2>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-ink-faint">
                  <th className="px-4 py-3 font-medium sm:px-5">Employee</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell sm:px-5">Department</th>
                  <th className="px-4 py-3 font-medium text-right sm:px-5">Annual</th>
                  <th className="hidden px-4 py-3 font-medium text-right sm:table-cell sm:px-5">Monthly</th>
                  <th className="px-4 py-3 font-medium text-right sm:px-5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {salaries.map((s) => (
                  <tr key={s.employeeId} className="border-b border-border last:border-0 hover:bg-surface-2">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-chart-2 text-[11px] font-semibold text-white">
                          {initialsOf(s.name)}
                        </div>
                        <span className="font-medium text-ink">{s.name}</span>
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-ink-muted md:table-cell sm:px-5">{s.department}</td>
                    <td className="px-4 py-3 text-right text-ink sm:px-5">
                      {s.salary > 0 ? formatMoney(s.salary) : <span className="text-ink-faint">Not set</span>}
                    </td>
                    <td className="hidden px-4 py-3 text-right text-ink-muted sm:table-cell sm:px-5">
                      {s.salary > 0 ? formatMoney(Math.round(s.salary / 12)) : "—"}
                    </td>
                    <td className="px-4 py-3 sm:px-5">
                      <div className="flex justify-end">
                        <button
                          onClick={() => {
                            setEditingSalary(s);
                            setSalaryModalOpen(true);
                          }}
                          aria-label={`Edit ${s.name}'s salary`}
                          className="grid h-8 w-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface hover:text-accent"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ---- Pay runs ---- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-ink">Pay runs</h2>
          </div>
          <button
            onClick={() => setRunModalOpen(true)}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            New pay run
          </button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* Runs list */}
          <div className="space-y-3">
            {payRuns.map((r) => {
              const active = r.id === selectedRun?.id;
              const net = r.payslips.reduce((s, p) => s + p.net, 0);
              return (
                <div
                  key={r.id}
                  className={[
                    "rounded-2xl border bg-surface p-4 transition-colors",
                    active ? "border-accent/60 ring-1 ring-accent/40" : "border-border hover:border-accent/40",
                  ].join(" ")}
                >
                  <button onClick={() => setSelectedRunId(r.id)} className="block w-full text-left">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-ink">{r.period}</p>
                      <RunStatusBadge status={r.status} />
                    </div>
                    <p className="mt-2 text-xs text-ink-muted">
                      {r.payslips.length} payslip{r.payslips.length === 1 ? "" : "s"} · net {formatMoney(net)}
                    </p>
                  </button>
                  <div className="mt-3 flex items-center gap-1">
                    {r.status === "Draft" && (
                      <button
                        onClick={() => handleFinalize(r.id)}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-faint transition-colors hover:bg-surface-2 hover:text-good"
                      >
                        <Lock className="h-3.5 w-3.5" /> Finalize
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteRun(r.id, r.period)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-faint transition-colors hover:bg-surface-2 hover:text-critical"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
            {payRuns.length === 0 && (
              <div className="rounded-2xl border border-border bg-surface p-8 text-center">
                <p className="text-sm font-medium text-ink">No pay runs yet</p>
                <p className="mt-1 text-sm text-ink-muted">Create one to generate payslips.</p>
              </div>
            )}
          </div>

          {/* Selected run payslips */}
          <div className="rounded-2xl border border-border bg-surface">
            {selectedRun ? (
              <>
                <div className="flex items-center justify-between border-b border-border p-5">
                  <div>
                    <h3 className="text-base font-semibold text-ink">{selectedRun.period} payslips</h3>
                    <p className="text-xs text-ink-muted">
                      {selectedRun.payslips.length} employees · total net {formatMoney(runNet)}
                    </p>
                  </div>
                  <RunStatusBadge status={selectedRun.status} />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs uppercase tracking-wider text-ink-faint">
                        <th className="px-4 py-3 font-medium sm:px-5">Employee</th>
                        <th className="hidden px-4 py-3 font-medium text-right sm:table-cell sm:px-5">Gross</th>
                        <th className="hidden px-4 py-3 font-medium text-right md:table-cell sm:px-5">Deductions</th>
                        <th className="px-4 py-3 font-medium text-right sm:px-5">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedRun.payslips.map((p) => (
                        <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                          <td className="px-4 py-3 font-medium text-ink sm:px-5">{p.employeeName}</td>
                          <td className="hidden px-4 py-3 text-right text-ink-muted sm:table-cell sm:px-5">{formatMoney(p.gross)}</td>
                          <td className="hidden px-4 py-3 text-right text-critical md:table-cell sm:px-5">−{formatMoney(p.deductions)}</td>
                          <td className="px-4 py-3 text-right font-medium text-ink sm:px-5">{formatMoney(p.net)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {selectedRun.payslips.length === 0 && (
                    <div className="grid place-items-center py-12 text-center">
                      <p className="text-sm text-ink-muted">No payslips in this run.</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="grid h-full place-items-center p-12 text-center">
                <p className="text-sm text-ink-muted">Select or create a pay run.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <SalaryModal
        open={salaryModalOpen}
        employee={editingSalary}
        onClose={() => setSalaryModalOpen(false)}
        onSave={handleSaveSalary}
      />
      <PayRunModal open={runModalOpen} onClose={() => setRunModalOpen(false)} onCreate={handleCreateRun} />
    </div>
  );
}
