"use client"; // Error boundaries must be Client Components (Next.js rule)

import "./globals.css";

/*
  The last-resort error screen: only used if the ROOT layout itself crashes
  (every other error is caught by (dashboard)/error.tsx inside the shell).
  It replaces the whole document, so it needs its own <html>/<body> and
  imports the global styles itself. Kept deliberately tiny.
*/
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body className="grid min-h-dvh place-items-center bg-bg px-gutter text-ink">
        <title>Something went wrong · HR Dashboard</title>
        <main className="max-w-md text-center">
          <h1 className="text-headline-lg">Something went wrong on our side</h1>
          <p className="mt-2 text-body-md text-ink-muted">Your data is safe. Please try again in a moment.</p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="mt-6 inline-flex min-h-tap items-center justify-center rounded-full bg-accent px-6 text-label-md font-semibold text-on-accent hover:bg-accent-hover"
          >
            Try again
          </button>
          {error.digest && <p className="mt-6 text-label-sm text-ink-muted">Error reference: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
