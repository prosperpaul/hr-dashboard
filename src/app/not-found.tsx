import Link from "next/link";
import { House, SearchX } from "lucide-react";
import StatusScreen from "@/components/ui/StatusScreen";
import { buttonClass } from "@/components/ui/button";

/*
  The app-wide 404: any URL that matches no route at all (e.g. a typo).
  It renders inside the root layout only — there's no dashboard shell
  here — so it centres itself on the paper background.
*/
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-bg px-gutter">
      <div className="w-full">
        <StatusScreen
          icon={SearchX}
          tone="accent"
          eyebrow="404 · Not found"
          title="We couldn't find that page"
          description="The link may be out of date, or the page may have moved. Head back home and try again from there."
          actions={
            <Link href="/" className={`${buttonClass("navy")} w-full sm:w-auto`}>
              <House className="h-4 w-4" aria-hidden />
              Back to Home
            </Link>
          }
        />
      </div>
    </main>
  );
}
