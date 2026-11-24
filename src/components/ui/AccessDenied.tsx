import Link from "next/link";
import { House, ShieldUser } from "lucide-react";
import StatusScreen from "./StatusScreen";
import { buttonClass } from "./button";

/*
  AccessDenied — what a page shows when the signed-in role isn't allowed in
  (e.g. an Employee opening /users). It's only the MESSAGE: the actual
  security check stays in the server page, which returns this INSTEAD of
  fetching any data, so nothing sensitive ever reaches the browser.

  Example:
    if (!canManageUsers(role)) {
      return <AccessDenied role={role} required="Admin" audience="Admins" section="User accounts" />;
    }
*/
export default function AccessDenied({
  role,
  required,
  audience,
  section,
  reason,
}: {
  role?: string | null; // the viewer's role (from the session)
  required: string; // who CAN open it, in words, e.g. "Admin or HR"
  audience?: string; // headline wording, e.g. "Admins" (defaults to `required`)
  section: string; // the page's name, e.g. "Payroll"
  reason?: string; // optional extra sentence on why it's restricted
}) {
  const yourRole = role || "Unknown";
  return (
    <StatusScreen
      icon={ShieldUser}
      tone="neutral"
      badge={
        <>
          Your role: <span className="font-semibold text-ink">{yourRole}</span> · Required:{" "}
          <span className="font-semibold text-ink">{required}</span>
        </>
      }
      title={`This section is for ${audience ?? required}`}
      description={
        <>
          You&apos;re signed in as {/^(?:[aeiou]|HR\b)/i.test(yourRole) ? "an" : "a"} {yourRole}, so {section} isn&apos;t available to you.
          {reason ? ` ${reason}` : ""} If you think you need access, ask an Admin to update your role.
        </>
      }
      actions={
        <Link href="/" className={`${buttonClass("navy")} w-full sm:w-auto`}>
          <House className="h-4 w-4" aria-hidden />
          Back to Home
        </Link>
      }
    />
  );
}
