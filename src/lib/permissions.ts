/*
  One source of truth for "who is allowed to do what".

  This file is pure logic — no database, no server-only imports — so BOTH
  the server (to enforce rules) and the client (to show/hide buttons) can
  import it. That way the UI and the security check can never disagree.
*/

// The roles a user can have. `as const` makes them a fixed set of strings.
export const ROLES = ["Admin", "HR", "Manager", "Employee"] as const;
export type Role = (typeof ROLES)[number];

/*
  Can this role create/edit/delete employees?
  Only Admin and HR manage the employee directory. Managers and Employees
  get read-only access.

  We accept `string | null | undefined` (not just Role) because the value
  comes from the session, which is loosely typed — this keeps callers simple.
*/
export function canManageEmployees(role?: string | null): boolean {
  return role === "Admin" || role === "HR";
}

// Can this role create/edit/delete departments? Same as employees: Admin/HR.
export function canManageDepartments(role?: string | null): boolean {
  return role === "Admin" || role === "HR";
}

/*
  Can this role manage leave (create requests, approve/reject, delete)?
  Managers also handle leave for their people, so this is broader than the
  Admin/HR pair: Admin, HR, and Manager.
*/
export function canManageLeave(role?: string | null): boolean {
  return role === "Admin" || role === "HR" || role === "Manager";
}

// Can this role see/manage EVERYONE's attendance? Admin, HR, and Manager.
export function canManageAttendance(role?: string | null): boolean {
  return role === "Admin" || role === "HR" || role === "Manager";
}

// Can this role write/manage performance reviews? Admin, HR, and Manager.
export function canManageReviews(role?: string | null): boolean {
  return role === "Admin" || role === "HR" || role === "Manager";
}

// Can this role use recruitment (jobs + candidates)? Admin, HR, and Manager
// (hiring managers). No employee self-service — candidate data is sensitive.
export function canManageRecruitment(role?: string | null): boolean {
  return role === "Admin" || role === "HR" || role === "Manager";
}

// Can this role manage PAYROLL (salaries, pay runs)? Admin and HR ONLY —
// this is the most sensitive area (compensation), so Managers are excluded.
export function canManagePayroll(role?: string | null): boolean {
  return role === "Admin" || role === "HR";
}

/*
  Can this role manage LOGIN ACCOUNTS (create users, assign roles)?
  This is the most powerful action — it decides who can get in and with what
  privileges — so we restrict it to Admin only.
*/
export function canManageUsers(role?: string | null): boolean {
  return role === "Admin";
}
