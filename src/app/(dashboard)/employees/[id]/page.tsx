import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, CalendarDays, Lock, Mail, Plane } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  canManageAttendance,
  canManageEmployees,
  canManageLeave,
  canManagePayroll,
  canManageReviews,
} from "@/lib/permissions";
import { APP_TIME_ZONE, formatDay, formatDuration, formatTime, minutesWorked, todayISO } from "@/lib/attendance";
import { formatLeaveRange, leaveStyle, usedAllowanceDays } from "@/lib/leave";
import { computePayslip, formatMoney, periodLabel } from "@/lib/payroll";
import { ratingLabel } from "@/lib/performance";
import { deptBadgeClass } from "@/lib/dept-tint";
import type { Employee, EmployeeStatus } from "@/lib/sample-data";
import EmployeeAvatar from "@/components/employees/EmployeeAvatar";
import ProfileActions from "@/components/employees/ProfileActions";
import { statusDot } from "@/components/employees/StatusBadge";
import { formatDate, formatMonthYear, tenure } from "@/components/employees/employee-format";
import AttendanceStatusBadge from "@/components/attendance/AttendanceStatusBadge";

/*
  One employee's profile ("employee record"), at /employees/<id>.

  This is a SERVER component: it reads the database directly and sends
  finished HTML. In this Next.js version `params` is a Promise, so we
  `await` it to get the id from the URL.

  Who sees what (mirrors the rest of the app):
  - Basic details (name, role, department, status, start date): anyone signed
    in — the same people who can open the Employees directory.
  - Leave: the person themselves, or anyone who can manage leave.
  - Attendance: the person themselves, or anyone who can manage attendance.
  - Reviews: managers/HR/Admin see all; the person sees only shared ones
    (not Drafts) — exactly like the Performance page.
  - Salary + all payslips: Admin/HR only (canManagePayroll), like the Payroll
    page. The person themselves sees only their own FINALIZED payslips.
*/
export default async function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Signed-in check (the layout and proxy already do this — belt and braces).
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  const today = todayISO(); // decided on the server, in the business time zone
  const year = Number(today.slice(0, 4));

  // The employee, their department, the department list (for the edit form)
  // and which employee record belongs to the viewer — all in parallel.
  const [record, departments, me] = await Promise.all([
    prisma.employee.findUnique({
      where: { id },
      include: { department: { select: { name: true } }, user: { select: { role: true } } },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { employeeId: true } }),
  ]);

  // Unknown id → the standard 404 page.
  if (!record) notFound();

  // ── Permissions for this viewer + this profile ──────────────────────
  const isSelf = me?.employeeId === record.id;
  const canManage = canManageEmployees(role);
  const canSeeLeave = isSelf || canManageLeave(role);
  const canSeeAttendance = isSelf || canManageAttendance(role);
  const canSeeAllReviews = canManageReviews(role);
  const canSeeReviews = canSeeAllReviews || isSelf;
  const canSeePayroll = canManagePayroll(role); // salary: Admin/HR only
  const canSeeOwnPayslips = isSelf && !canSeePayroll;

  // ── Only load the sections this viewer is allowed to see ────────────
  const [leave, attendance, reviews, payslips] = await Promise.all([
    canSeeLeave
      ? prisma.leaveRequest.findMany({ where: { employeeId: record.id }, orderBy: { startDate: "desc" } })
      : Promise.resolve([]),
    canSeeAttendance
      ? prisma.attendanceRecord.findMany({ where: { employeeId: record.id }, orderBy: { date: "desc" }, take: 30 })
      : Promise.resolve([]),
    canSeeReviews
      ? prisma.performanceReview.findMany({
          where: canSeeAllReviews ? { employeeId: record.id } : { employeeId: record.id, status: { in: ["Submitted", "Acknowledged"] } },
          orderBy: { updatedAt: "desc" },
        })
      : Promise.resolve([]),
    canSeePayroll || canSeeOwnPayslips
      ? prisma.payslip.findMany({
          where: canSeePayroll ? { employeeId: record.id } : { employeeId: record.id, payRun: { status: "Finalized" } },
          orderBy: { payRun: { period: "desc" } },
          take: 6,
          include: { payRun: { select: { period: true, status: true } } },
        })
      : Promise.resolve([]),
  ]);

  // The clean shape the edit form expects.
  const employee: Employee = {
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    departmentId: record.departmentId,
    department: record.department?.name ?? "Unassigned",
    status: record.status as EmployeeStatus,
    startedAt: record.startedAt,
    leaveAllowance: record.leaveAllowance,
  };
  const deptName = record.department?.name ?? null;

  // ── Leave numbers (this calendar year) ──────────────────────────────
  const thisYear = leave.filter((l) => l.startDate.startsWith(String(year)));
  const usedPaid = usedAllowanceDays(leave, year);
  const remaining = Math.max(0, record.leaveAllowance - usedPaid);
  const sickDays = thisYear.filter((l) => l.status === "Approved" && l.type === "Sick").reduce((s, l) => s + l.days, 0);
  const unpaidDays = thisYear.filter((l) => l.status === "Approved" && l.type === "Unpaid").reduce((s, l) => s + l.days, 0);
  const pendingDays = leave.filter((l) => l.status === "Pending").reduce((s, l) => s + l.days, 0);
  // The next leave that hasn't finished yet (approved or still pending).
  const nextLeave = [...leave]
    .filter((l) => l.endDate >= today && l.status !== "Rejected")
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

  // ── Attendance summary over the last (up to) 30 records ─────────────
  const attCount = (s: string) => attendance.filter((a) => a.status === s).length;
  const onTimeBase = attCount("Present") + attCount("Late");
  const onTimeRate = onTimeBase ? Math.round((attCount("Present") / onTimeBase) * 100) : null;

  // ── Timeline: hire date + reviews, newest first ─────────────────────
  type TimelineItem = { date: string; tag: string; title: string; body?: string };
  const timeline: TimelineItem[] = [
    ...reviews.map((r) => ({
      date: todayISO(r.updatedAt),
      tag: r.status === "Draft" ? "Review draft" : "Review",
      title: `${r.period} review · ${ratingLabel(r.rating)} (${r.rating}/5)`,
      body: `Reviewed by ${r.reviewerName}.`,
    })),
    { date: record.startedAt, tag: "Hire", title: `Joined as ${record.role}`, body: deptName ? `Started in ${deptName}.` : undefined },
  ].sort((a, b) => b.date.localeCompare(a.date));

  // ── Headline metrics strip (only what this viewer may see) ──────────
  const latestShared = reviews[0];
  const metrics: { label: string; value: string; note?: string }[] = [
    { label: "Tenure", value: tenure(record.startedAt, today), note: `Since ${formatDate(record.startedAt)}` },
    canSeeLeave
      ? { label: "Leave balance", value: `${remaining} days`, note: `${usedPaid} of ${record.leaveAllowance} used in ${year}` }
      : { label: "Leave allowance", value: `${record.leaveAllowance} days`, note: "Paid days per year" },
  ];
  if (canSeeAttendance)
    metrics.push({ label: "On-time rate", value: onTimeRate === null ? "—" : `${onTimeRate}%`, note: `Last ${attendance.length} recorded days` });
  if (canSeeReviews)
    metrics.push({
      label: "Latest rating",
      value: latestShared ? `${latestShared.rating}/5` : "—",
      note: latestShared ? `${latestShared.period} · ${ratingLabel(latestShared.rating)}` : "No reviews yet",
    });

  const lastUpdated = record.updatedAt.toLocaleDateString("en-US", { timeZone: APP_TIME_ZONE, month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb strip ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/employees" className="inline-flex items-center gap-2 text-label-md text-ink transition-colors hover:text-ink-muted">
          <ArrowLeft className="h-4 w-4" />
          Back to Employees directory
        </Link>
        <p className="text-body-sm text-ink-muted">
          <span className="text-[11px] font-bold uppercase tracking-[0.06em]">Employee record</span>
          <span className="mx-2">·</span>
          Last updated {lastUpdated}
        </p>
      </div>

      {/* ── Navy hero band ── */}
      <section className="rounded-xl border border-navy-line bg-navy p-5 text-on-navy sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="relative w-fit">
              <EmployeeAvatar name={record.name} department={deptName} size="xl" />
              <span className={`absolute -bottom-1 -right-1 h-4 w-4 rounded-full ring-2 ring-navy ${statusDot(record.status)}`} />
            </div>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {deptName ? (
                  <span className={deptBadgeClass(deptName)}>{deptName}</span>
                ) : (
                  <span className="inline-flex h-6 items-center rounded-full border border-navy-line px-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-on-navy-muted">Unassigned</span>
                )}
                <span className="inline-flex items-center gap-1.5 text-body-sm text-on-navy-muted">
                  <span className={`h-1.5 w-1.5 rounded-full ${statusDot(record.status)}`} />
                  {record.status}
                </span>
                {isSelf && (
                  <span className="rounded-full bg-accent px-2 py-px text-[10px] font-bold uppercase tracking-[0.06em] text-on-accent">You</span>
                )}
              </div>
              <h1 className="break-words text-headline-lg text-on-navy md:text-headline-xl">{record.name}</h1>
              <p className="text-body-md text-on-navy">{record.role}</p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-body-sm text-on-navy-muted">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate">{record.email}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 shrink-0" />
                  Joined {formatMonthYear(record.startedAt)} ({tenure(record.startedAt, today)})
                </span>
              </div>
            </div>
          </div>
          <ProfileActions employee={employee} departments={departments} canManage={canManage} />
        </div>
      </section>

      {/* ── Metrics strip ── */}
      <section className={`grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-surface ${metrics.length === 4 ? "lg:grid-cols-4" : metrics.length === 3 ? "lg:grid-cols-3" : ""}`}>
        {metrics.map((m, i) => (
          <div key={m.label} className={`p-4 sm:p-5 ${i % 2 ? "border-l border-border" : ""} ${i >= 2 ? "border-t border-border lg:border-t-0 lg:border-l" : ""}`}>
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">{m.label}</p>
            <p className="tnum mt-1 text-metric-md text-ink">{m.value}</p>
            {m.note && <p className="text-body-sm text-ink-faint">{m.note}</p>}
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── Left column ── */}
        <div className="min-w-0 space-y-6">
          <Card eyebrow="Tenure & progression" title="Career timeline" aside={<Chip>{tenure(record.startedAt, today)}</Chip>}>
            <ol className="relative space-y-6 border-l border-border pl-6">
              {timeline.map((t, i) => (
                <li key={`${t.tag}-${t.date}-${i}`} className="relative">
                  <span className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4 ring-surface ${i === 0 ? "bg-accent" : "bg-navy"}`} />
                  <p className="flex flex-wrap items-center gap-2 text-body-sm text-ink-muted">
                    <span className="tnum font-semibold text-ink">{formatDate(t.date)}</span>
                    <span className="rounded-full bg-surface-2 px-2 py-px text-[10px] font-bold uppercase tracking-[0.06em] text-ink">{t.tag}</span>
                  </p>
                  <p className="mt-1 text-body-md font-semibold text-ink">{t.title}</p>
                  {t.body && <p className="text-body-sm text-ink-muted">{t.body}</p>}
                </li>
              ))}
            </ol>
          </Card>

          {canSeeLeave && (
            <Card eyebrow="Annual entitlements" title="Time-off & leave balances" aside={<span className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Cycle: Jan 01 – Dec 31</span>}>
              <div className="space-y-5">
                <Meter label="Annual paid leave" detail={`${remaining} of ${record.leaveAllowance} days remaining (${usedPaid} used)`} value={usedPaid} max={record.leaveAllowance} />
                <div className="grid grid-cols-3 gap-3">
                  <MiniStat label="Sick days" value={sickDays} />
                  <MiniStat label="Unpaid days" value={unpaidDays} />
                  <MiniStat label="Pending" value={pendingDays} />
                </div>

                {nextLeave && (
                  <div className="flex items-center gap-4 rounded-xl border border-border p-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink">
                      <Plane className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Next scheduled leave</p>
                      <p className="text-body-md font-semibold text-ink">{nextLeave.type} leave</p>
                      <p className="tnum text-body-sm text-ink-muted">
                        {formatLeaveRange(nextLeave.startDate, nextLeave.endDate)} · {nextLeave.days} {nextLeave.days === 1 ? "day" : "days"}
                      </p>
                    </div>
                    <LeaveStatus status={nextLeave.status} />
                  </div>
                )}

                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Recent requests</p>
                  {leave.length === 0 ? (
                    <p className="text-body-sm text-ink-faint">No leave requests yet.</p>
                  ) : (
                    <ul className="divide-y divide-border border-y border-border">
                      {leave.slice(0, 6).map((l) => (
                        <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-label-sm ${leaveStyle(l.type).chip}`}>{l.type}</span>
                            <span className="tnum text-body-sm text-ink">{formatLeaveRange(l.startDate, l.endDate)}</span>
                            <span className="tnum text-body-sm text-ink-faint">
                              {l.days} {l.days === 1 ? "day" : "days"}
                            </span>
                          </div>
                          <LeaveStatus status={l.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </Card>
          )}

          {canSeeReviews && (
            <Card
              eyebrow="Performance"
              title="Reviews"
              aside={
                <Link href="/performance" className="text-label-md text-ink underline underline-offset-4 hover:opacity-80">
                  Open performance
                </Link>
              }
            >
              {reviews.length === 0 ? (
                <p className="text-body-sm text-ink-faint">No {canSeeAllReviews ? "" : "shared "}reviews yet.</p>
              ) : (
                <ul className="space-y-4">
                  {reviews.map((r) => (
                    <li key={r.id} className="rounded-xl border border-border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-body-md font-semibold text-ink">{r.period}</p>
                          <p className="text-body-sm text-ink-muted">
                            {ratingLabel(r.rating)} · by {r.reviewerName}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="tnum font-display text-headline-sm text-ink">{r.rating}/5</span>
                          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-ink">{r.status}</span>
                        </div>
                      </div>
                      {(r.strengths || r.goals) && (
                        <dl className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
                          {r.strengths && (
                            <div>
                              <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Strengths</dt>
                              <dd className="mt-0.5 line-clamp-3 text-body-sm text-ink">{r.strengths}</dd>
                            </div>
                          )}
                          {r.goals && (
                            <div>
                              <dt className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Goals</dt>
                              <dd className="mt-0.5 line-clamp-3 text-body-sm text-ink">{r.goals}</dd>
                            </div>
                          )}
                        </dl>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="min-w-0 space-y-6">
          <Card eyebrow="Official records" title="Contact & details">
            <dl className="divide-y divide-border text-body-sm">
              <Row label="Work email" value={<a href={`mailto:${record.email}`} className="break-all underline-offset-2 hover:underline">{record.email}</a>} />
              <Row label="Role" value={record.role} />
              <Row label="Department" value={deptName ?? "Unassigned"} />
              <Row label="Status" value={record.status} />
              <Row label="Start date" value={formatDate(record.startedAt)} />
              <Row label="Leave allowance" value={`${record.leaveAllowance} days / yr`} />
              {canManage && <Row label="Login account" value={record.user ? `Linked · ${record.user.role}` : "Not linked"} />}
            </dl>
          </Card>

          {canSeeAttendance && (
            <Card
              eyebrow="Attendance"
              title="Recent days"
              aside={
                <Link href="/attendance" className="text-label-md text-ink underline underline-offset-4 hover:opacity-80">
                  View all
                </Link>
              }
            >
              {attendance.length === 0 ? (
                <p className="text-body-sm text-ink-faint">No attendance recorded yet.</p>
              ) : (
                <>
                  <div className="mb-4 grid grid-cols-4 gap-2 text-center">
                    {(["Present", "Late", "Remote", "Absent"] as const).map((s) => (
                      <div key={s} className="rounded-lg bg-bg px-1 py-2">
                        <p className="tnum font-display text-headline-sm text-ink">{attCount(s)}</p>
                        <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">{s === "Present" ? "On time" : s}</p>
                      </div>
                    ))}
                  </div>
                  <ul className="divide-y divide-border border-t border-border">
                    {attendance.slice(0, 7).map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 py-2.5">
                        <div className="min-w-0">
                          <p className="text-body-sm font-semibold text-ink">{formatDay(a.date)}</p>
                          <p className="tnum text-body-sm text-ink-muted">
                            {formatTime(a.clockIn)} – {formatTime(a.clockOut)} · {formatDuration(minutesWorked(a.clockIn, a.clockOut))}
                          </p>
                        </div>
                        <AttendanceStatusBadge status={a.status} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          )}

          {canSeePayroll && (
            <Card eyebrow="Compensation" title="Salary & payslips" aside={<Lock className="h-4 w-4 text-ink-muted" aria-label="Restricted to Admin and HR" />}>
              <SalaryBlock salary={record.salary} />
              <PayslipList payslips={payslips} showRunStatus />
              <p className="mt-4 text-body-sm text-ink-faint">Restricted · Admin &amp; HR only</p>
            </Card>
          )}

          {canSeeOwnPayslips && (
            <Card
              eyebrow="Payroll"
              title="Your payslips"
              aside={
                <Link href="/payroll" className="text-label-md text-ink underline underline-offset-4 hover:opacity-80">
                  View all
                </Link>
              }
            >
              <PayslipList payslips={payslips} />
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page-local building blocks ─────────────────────────────────────────

// A white card with a caps eyebrow, a title and an optional right-side extra.
function Card({ eyebrow, title, aside, children }: { eyebrow: string; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">{eyebrow}</p>
          <h2 className="text-headline-sm text-ink">{title}</h2>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="tnum whitespace-nowrap rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-accent-ink">{children}</span>;
}

// "Label ......... value" row for the details card.
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right text-ink">{value}</dd>
    </div>
  );
}

// A labelled progress bar (used / max).
function Meter({ label, detail, value, max }: { label: string; detail: string; value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-body-sm font-semibold text-ink">{label}</span>
        <span className="tnum text-body-sm text-ink-muted">{detail}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
        <div className="h-full rounded-full bg-navy" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-bg px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">{label}</p>
      <p className="tnum font-display text-headline-sm text-ink">
        {value} <span className="text-body-sm font-normal text-ink-muted">{value === 1 ? "day" : "days"}</span>
      </p>
    </div>
  );
}

// Approved / Pending / Rejected as a small coloured pill.
function LeaveStatus({ status }: { status: string }) {
  const tone =
    status === "Approved" ? "bg-good/10 text-good" : status === "Rejected" ? "bg-critical/10 text-critical" : "bg-warning/10 text-warning";
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] ${tone}`}>{status}</span>;
}

// Annual salary plus the monthly breakdown the payroll page uses.
function SalaryBlock({ salary }: { salary: number }) {
  const month = computePayslip(salary);
  return (
    <div className="mb-5">
      <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Annual gross salary</p>
      <p className="tnum mt-1 text-metric-md text-ink">{salary > 0 ? formatMoney(salary) : "Not set"}</p>
      {salary > 0 && (
        <dl className="mt-3 grid grid-cols-3 gap-2 text-body-sm">
          {[
            ["Monthly gross", month.gross],
            ["Deductions", month.deductions],
            ["Net pay", month.net],
          ].map(([label, n]) => (
            <div key={label} className="rounded-lg bg-bg px-2.5 py-2">
              <dt className="text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">{label}</dt>
              <dd className="tnum font-semibold text-ink">{formatMoney(Number(n))}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

// The most recent payslips (net pay per period).
function PayslipList({
  payslips,
  showRunStatus = false,
}: {
  payslips: { id: string; net: number; gross: number; payRun: { period: string; status: string } }[];
  showRunStatus?: boolean;
}) {
  if (payslips.length === 0) return <p className="text-body-sm text-ink-faint">No payslips yet.</p>;
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">Recent payslips</p>
      <ul className="divide-y divide-border border-y border-border">
        {payslips.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 py-2.5 text-body-sm">
            <span className="text-ink">
              {periodLabel(p.payRun.period)}
              {showRunStatus && p.payRun.status !== "Finalized" && (
                <span className="ml-2 rounded-full bg-surface-2 px-2 py-px text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">{p.payRun.status}</span>
              )}
            </span>
            <span className="tnum font-semibold text-ink">{formatMoney(p.net)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
