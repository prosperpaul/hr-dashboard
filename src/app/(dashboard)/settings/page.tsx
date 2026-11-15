import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import {
  canManageEmployees,
  canManageDepartments,
  canManageLeave,
  canManageAttendance,
  canManageReviews,
  canManageRecruitment,
  canManagePayroll,
  canManageUsers,
} from "@/lib/permissions";
import { APP_TIME_ZONE, LATE_AFTER_LABEL } from "@/lib/attendance";
import { DEDUCTION_RATE } from "@/lib/payroll";
import AccountSettings from "@/components/settings/AccountSettings";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      role: true,
      createdAt: true,
      employee: { select: { name: true, role: true, department: { select: { name: true } } } },
    },
  });
  if (!user) redirect("/login");

  const role = user.role;
  // What this role may do — read from the SAME rules the server enforces,
  // so this list can never drift from reality.
  const permissions = [
    { label: "Manage employees", detail: "Add, edit and remove employee records", allowed: canManageEmployees(role) },
    { label: "Manage departments", detail: "Create, rename and delete departments", allowed: canManageDepartments(role) },
    { label: "Approve leave", detail: "Approve or reject everyone's time off", allowed: canManageLeave(role) },
    { label: "View all attendance", detail: "See and correct everyone's clock-ins", allowed: canManageAttendance(role) },
    { label: "Write performance reviews", detail: "Create, share and edit reviews", allowed: canManageReviews(role) },
    { label: "Recruitment", detail: "Post jobs and manage candidates", allowed: canManageRecruitment(role) },
    { label: "Payroll", detail: "Set salaries and run payroll", allowed: canManagePayroll(role) },
    { label: "User accounts", detail: "Create logins and assign roles", allowed: canManageUsers(role) },
  ];

  // The workspace-wide rules currently built into the app.
  const workspace = [
    { label: "Time zone", value: "West Africa Time (WAT)", hint: APP_TIME_ZONE },
    { label: "Currency", value: "Nigerian Naira (₦)", hint: "NGN" },
    { label: "Leave year", value: "January – December", hint: "Allowances reset each year" },
    { label: "Late after", value: LATE_AFTER_LABEL, hint: "Clock-ins after this are marked Late" },
    { label: "Payroll deductions", value: `${Math.round(DEDUCTION_RATE * 100)}% flat estimate`, hint: "Tax & statutory" },
  ];

  return (
    <AccountSettings
      account={{
        name: user.name,
        email: user.email,
        role,
        memberSince: user.createdAt.toISOString(),
        employee: user.employee
          ? { name: user.employee.name, title: user.employee.role, department: user.employee.department?.name ?? null }
          : null,
      }}
      permissions={permissions}
      workspace={workspace}
    />
  );
}
