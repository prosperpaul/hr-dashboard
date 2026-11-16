/*
  Public demo mode.

  Turned on with the environment variable NEXT_PUBLIC_DEMO_MODE=true (set it
  on the demo deployment only — a real customer deployment simply leaves it
  out). It's "NEXT_PUBLIC_" because the login page (browser code) also needs
  to know whether to show the "Try the demo" buttons; the value isn't secret.

  When it's on:
   • visitors can sign in with one click as any of the demo accounts below;
   • those demo accounts can't change passwords/names or manage logins, so
     nobody can lock the demo (or you) out;
   • a nightly job (/api/cron/reset-demo) restores fresh sample data.

  Pure module: safe to import from both server and browser code.
*/

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export type DemoRole = "Admin" | "HR" | "Manager" | "Employee";

export const DEMO_ACCOUNTS: { role: DemoRole; email: string; name: string; blurb: string }[] = [
  { role: "Admin", email: "admin@hrdashboard.com", name: "Ada Admin", blurb: "Everything, incl. user accounts" },
  { role: "HR", email: "hr@hrdashboard.com", name: "Hana HR", blurb: "People, payroll & recruiting" },
  { role: "Manager", email: "manager@hrdashboard.com", name: "Max Manager", blurb: "Approvals, reviews & hiring" },
  { role: "Employee", email: "employee@hrdashboard.com", name: "Amara Okafor", blurb: "Self-service: leave, pay, clock-in" },
];

// Is this signed-in email one of the shared demo accounts (while demo mode is on)?
export function isDemoUser(email?: string | null): boolean {
  if (!DEMO_MODE || !email) return false;
  const e = email.toLowerCase();
  return DEMO_ACCOUNTS.some((a) => a.email === e);
}

export const DEMO_LOCKED_MESSAGE =
  "This is disabled in the public demo so visitors can't lock each other out. Everything else works — and the data resets every night.";
