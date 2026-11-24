import Link from "next/link";
import { House, SearchX } from "lucide-react";
import StatusScreen from "@/components/ui/StatusScreen";
import { buttonClass } from "@/components/ui/button";

/*
  Shown inside the dashboard shell when a page calls notFound() — e.g.
  /employees/<id> for an employee that doesn't exist (or was deleted).
*/
export default function DashboardNotFound() {
  return (
    <StatusScreen
      icon={SearchX}
      tone="accent"
      eyebrow="404 · Not found"
      title="We couldn't find that page"
      description="The link may be out of date, or the record may have been removed. Head back home and try again from there."
      actions={
        <Link href="/" className={`${buttonClass("navy")} w-full sm:w-auto`}>
          <House className="h-4 w-4" aria-hidden />
          Back to Home
        </Link>
      }
    />
  );
}
