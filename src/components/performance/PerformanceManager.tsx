"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Pencil, Trash2, Send, Undo2, Award } from "lucide-react";
import { initialsOf } from "@/lib/sample-data";
import { REVIEW_STATUSES, type ReviewRow, type ReviewInput } from "@/lib/performance";
import {
  createReview,
  updateReview,
  setReviewStatus,
  deleteReview,
} from "@/lib/performance-actions";
import ReviewFormModal from "./ReviewFormModal";
import Stars from "./Stars";

type EmployeeOption = { id: string; name: string };

function ReviewStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Draft: "bg-surface-2 text-ink-muted ring-border",
    Submitted: "bg-accent-soft text-accent ring-accent/40",
    Acknowledged: "bg-good/15 text-good ring-good/40",
  };
  const cls = styles[status] ?? "bg-surface-2 text-ink-muted ring-border";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cls}`}>
      {status}
    </span>
  );
}

export default function PerformanceManager({
  initialReviews,
  employees,
}: {
  initialReviews: ReviewRow[];
  employees: EmployeeOption[];
}) {
  const [list, setList] = useState<ReviewRow[]>(initialReviews);
  const [statusFilter, setStatusFilter] = useState("All");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ReviewRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(
    () => (statusFilter === "All" ? list : list.filter((r) => r.status === statusFilter)),
    [list, statusFilter],
  );

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }
  function openEdit(review: ReviewRow) {
    setEditing(review);
    setModalOpen(true);
  }

  function handleSave(data: ReviewInput, id?: string) {
    startTransition(async () => {
      try {
        if (id) {
          await updateReview(id, data);
          setList((prev) =>
            prev.map((r) =>
              r.id === id
                ? { ...r, period: data.period, rating: data.rating, strengths: data.strengths || null, goals: data.goals || null }
                : r,
            ),
          );
        } else {
          await createReview(data);
          const empName = employees.find((e) => e.id === data.employeeId)?.name ?? "—";
          setList((prev) => [
            {
              id: `temp-${Date.now()}`,
              employeeId: data.employeeId,
              employeeName: empName,
              reviewerName: "You",
              period: data.period,
              rating: data.rating,
              strengths: data.strengths || null,
              goals: data.goals || null,
              status: "Draft",
            },
            ...prev,
          ]);
        }
        setModalOpen(false);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Could not save the review.");
      }
    });
  }

  function handleStatus(review: ReviewRow, status: string) {
    startTransition(async () => {
      try {
        await setReviewStatus(review.id, status);
        setList((prev) => prev.map((r) => (r.id === review.id ? { ...r, status } : r)));
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Could not update the review.");
      }
    });
  }

  function handleDelete(review: ReviewRow) {
    if (!window.confirm(`Delete ${review.employeeName}'s ${review.period} review?`)) return;
    startTransition(async () => {
      try {
        await deleteReview(review.id);
        setList((prev) => prev.filter((r) => r.id !== review.id));
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Could not delete the review.");
      }
    });
  }

  const selectClass =
    "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/40";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Performance</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {isPending ? "Working…" : `${list.length} review${list.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          onClick={openAdd}
          disabled={isPending || employees.length === 0}
          className="flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          New review
        </button>
      </div>

      <div className="flex items-center gap-3">
        <select className={selectClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="All">All statuses</option>
          {REVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-ink-faint">
                <th className="px-4 py-3 font-medium sm:px-5">Employee</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell sm:px-5">Period</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell sm:px-5">Rating</th>
                <th className="hidden px-4 py-3 font-medium lg:table-cell sm:px-5">Reviewer</th>
                <th className="px-4 py-3 font-medium sm:px-5">Status</th>
                <th className="px-4 py-3 font-medium text-right sm:px-5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 transition-colors hover:bg-surface-2">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-chart-2 text-[11px] font-semibold text-white">
                        {initialsOf(r.employeeName)}
                      </div>
                      <span className="font-medium text-ink">{r.employeeName}</span>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-ink-muted sm:table-cell sm:px-5">{r.period}</td>
                  <td className="hidden px-4 py-3 md:table-cell sm:px-5"><Stars rating={r.rating} /></td>
                  <td className="hidden px-4 py-3 text-ink-muted lg:table-cell sm:px-5">{r.reviewerName}</td>
                  <td className="px-4 py-3 sm:px-5"><ReviewStatusBadge status={r.status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {r.status === "Draft" && (
                        <button
                          onClick={() => handleStatus(r, "Submitted")}
                          aria-label="Submit review"
                          title="Submit to employee"
                          className="grid h-8 w-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface hover:text-accent"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      )}
                      {r.status === "Submitted" && (
                        <button
                          onClick={() => handleStatus(r, "Draft")}
                          aria-label="Unsubmit review"
                          title="Revert to draft"
                          className="grid h-8 w-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface hover:text-warning"
                        >
                          <Undo2 className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(r)}
                        aria-label={`Edit ${r.employeeName}'s review`}
                        className="grid h-8 w-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface hover:text-accent"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(r)}
                        aria-label={`Delete ${r.employeeName}'s review`}
                        className="grid h-8 w-8 place-items-center rounded-md text-ink-faint transition-colors hover:bg-surface hover:text-critical"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="grid place-items-center py-16 text-center">
            <div>
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-surface-2">
                <Award className="h-5 w-5 text-ink-faint" />
              </div>
              <p className="mt-3 text-sm font-medium text-ink">No reviews</p>
              <p className="mt-1 text-sm text-ink-muted">
                {statusFilter === "All" ? "Create the first review." : `No ${statusFilter.toLowerCase()} reviews.`}
              </p>
            </div>
          </div>
        )}
      </div>

      <ReviewFormModal
        open={modalOpen}
        editing={editing}
        employees={employees}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
