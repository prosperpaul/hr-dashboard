"use client"; // Error boundaries must be Client Components (Next.js rule)

import { useEffect } from "react";
import Link from "next/link";
import { CloudAlert, House, RotateCw } from "lucide-react";
import StatusScreen from "@/components/ui/StatusScreen";
import { buttonClass } from "@/components/ui/button";

/*
  Shown INSIDE the dashboard shell (top bar, sidebar, tab bar stay put)
  whenever a page in this group crashes — e.g. the database is unreachable.

  • unstable_retry() — this Next.js version's "Try again": it re-fetches the
    page from the server and re-renders it (the older `reset()` only
    re-rendered without fetching, which rarely fixes a server hiccup).
  • error.digest — a short code Next.js attaches to server errors. We show
    it so a user can quote it, and we can find the matching server log.
    (In production the real error message is hidden on purpose.)
*/
export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  // Log it in the browser console (a real error-reporting service could go here).
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusScreen
      icon={CloudAlert}
      tone="critical"
      title="Something went wrong on our side"
      description="We couldn't load this page just now. Your data is safe — please try again in a moment."
      actions={
        <>
          <button type="button" onClick={() => unstable_retry()} className={`${buttonClass("primary")} w-full sm:w-auto`}>
            <RotateCw className="h-4 w-4" aria-hidden />
            Try again
          </button>
          <Link href="/" className={`${buttonClass("secondary")} w-full sm:w-auto`}>
            <House className="h-4 w-4" aria-hidden />
            Go to Home
          </Link>
        </>
      }
      footnote={error.digest ? <>Error reference: <span className="font-mono">{error.digest}</span></> : undefined}
    />
  );
}
