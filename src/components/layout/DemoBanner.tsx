import { Sparkles } from "lucide-react";
import { DEMO_ACCOUNTS } from "@/lib/demo";
import { demoLogin } from "@/lib/auth-actions";

/*
  Thin strip at the top of every page for public-demo visitors.
  Shows which demo role they're using and lets them jump straight to another
  role (each button re-runs the one-click demo sign-in for that role).
*/
export default function DemoBanner({ role }: { role?: string | null }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-b border-accent/25 bg-accent-soft px-4 py-2 text-center text-body-sm text-ink">
      <span className="flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-accent-ink" />
        <span>
          <span className="font-medium">Live demo</span> — you&apos;re exploring as <span className="font-medium text-accent-ink">{role}</span>. Sample
          data resets every night.
        </span>
      </span>
      <span className="flex items-center gap-1">
        <span className="text-ink-faint">Switch role:</span>
        {DEMO_ACCOUNTS.filter((a) => a.role !== role).map((a) => (
          <form key={a.role} action={demoLogin}>
            <input type="hidden" name="role" value={a.role} />
            <button
              type="submit"
              className="rounded-full border border-accent/30 bg-surface/70 px-2 py-0.5 text-label-sm text-ink-muted transition-colors hover:border-accent/60 hover:text-ink"
            >
              {a.role}
            </button>
          </form>
        ))}
      </span>
    </div>
  );
}
