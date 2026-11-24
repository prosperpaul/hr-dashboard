"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  Users,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Sparkles,
  Briefcase,
  UserRound,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { login, demoLogin } from "@/lib/auth-actions";
import { DEMO_MODE, DEMO_ACCOUNTS } from "@/lib/demo";
import { ROLES } from "@/lib/permissions";
import ThemeToggle from "@/components/ThemeToggle";
import { inputClass as fieldClass } from "@/components/ui/form";

// Pre-fill demo credentials ONLY in development, and never on the public demo
// (there visitors use the one-click role buttons instead).
const isDev = process.env.NODE_ENV !== "production" && !DEMO_MODE;

const ROLE_ICONS: Record<string, LucideIcon> = { Admin: ShieldCheck, HR: Users, Manager: Briefcase, Employee: UserRound };

// Three true facts about the product, shown along the bottom of the navy panel.
// (No made-up stats — these describe how the app actually works.)
const FACTS = [
  { value: "₦", label: "Payroll in Naira" },
  { value: "WAT", label: "Lagos business time" },
  { value: String(ROLES.length), label: "Access roles" },
];

/*
  One role card on the demo login. useFormStatus tells us when THIS card's
  form is submitting, so we can show a spinner on the card you clicked.
*/
function DemoRoleButton({ role, blurb }: { role: string; blurb: string }) {
  const { pending } = useFormStatus();
  const Icon = ROLE_ICONS[role] ?? UserRound;
  return (
    <button
      type="submit"
      disabled={pending}
      className="group flex h-full min-h-tap w-full min-w-0 flex-col items-start gap-2 rounded-xl border border-border bg-surface p-3.5 text-left sm:p-4 transition-colors hover:border-ink disabled:opacity-70"
    >
      <span className="flex w-full items-center justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-on-accent">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}
        </span>
        <ArrowRight aria-hidden className="h-4 w-4 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
      </span>
      <span className="text-label-md text-ink [overflow-wrap:anywhere]">{pending ? "Opening…" : `Explore as ${role}`}</span>
      <span className="text-body-sm leading-snug text-ink-faint">{blurb}</span>
    </button>
  );
}

// The square navy logo mark with a yellow dot (matches the mockup's brand tile).
function LogoMark() {
  return (
    <span aria-hidden className="relative grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-navy">
      <span className="h-4 w-4 rounded-full bg-accent" />
    </span>
  );
}

/*
  Sign-in page. Left: navy brand panel (desktop only).
  Right: the actual form, wired to the `login` server action.
*/
export default function LoginPage() {
  // Local state only for the password show/hide toggle.
  const [showPassword, setShowPassword] = useState(false);

  // useActionState wires the form to our `login` server action.
  //  - state   : whatever the action returns (here, an optional error message)
  //  - action  : the function we hand to <form action={...}>
  //  - pending : true while the request is in flight (for the loading state)
  const [state, action, pending] = useActionState(login, undefined);

  // The shared field style (a sunken 48px well on phones, a bordered box on
  // desktop), kept at 48px tall on desktop too, as this page always was.
  const inputClass = `${fieldClass.replace(" lg:min-h-11", " lg:min-h-12").replace("px-3.5", "px-4")}`;
  const fieldLabel = "text-label-md font-semibold text-ink";

  return (
    // min-h-dvh = the *visible* screen height on phones (100vh would be taller
    // than the screen while the browser's address bar is showing).
    <main className="flex min-h-dvh w-full overflow-x-hidden bg-bg">
      {/* ───────────── Left: navy brand panel (desktop only) ───────────── */}
      <section
        aria-label="About HR Dashboard"
        className="relative hidden flex-col justify-between overflow-hidden bg-navy p-10 text-on-navy lg:flex lg:w-[56%] xl:p-16"
      >
        {/* Top row: product pill + security pill */}
        <header className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2.5 rounded-full bg-surface px-4 py-2 text-ink">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
            <span className="text-eyebrow uppercase">HR Dashboard</span>
            <span className="text-ink-faint">·</span>
            <span className="text-body-sm text-ink-muted">People operations</span>
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-navy-line bg-navy-2 px-4 py-2 text-body-sm text-on-navy">
            <Lock className="h-3.5 w-3.5" aria-hidden />
            Role-based access
          </span>
        </header>

        {/* Pitch, anchored to the bottom like the mockup's navy band */}
        <div className="mt-auto">
          <p className="text-eyebrow uppercase tracking-[0.12em] text-on-navy-muted">
            People operations platform <span className="mx-2">—</span> Payroll · Leave · Attendance
          </p>
          <h1 className="mt-5 max-w-2xl font-display text-[44px] font-bold leading-[1.05] tracking-[-0.03em] text-on-navy xl:text-[60px]">
            The people side of your company, in one <span className="text-accent">calm</span> place.
          </h1>
          <p className="mt-5 max-w-xl text-body-lg text-on-navy-muted">
            Run payroll, approve leave, track attendance, review performance and hire — from one fast, focused dashboard.
          </p>

          {/* Facts row */}
          <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-navy-line pt-8 xl:gap-6">
            {FACTS.map((f, i) => (
              // flex-col-reverse: label (dt) comes first in the HTML but shows under the value
              <div key={f.label} className="flex min-w-0 flex-col-reverse gap-2">
                <dt className="text-eyebrow uppercase text-on-navy-muted">{f.label}</dt>
                <dd className={`font-display text-[32px] font-bold leading-none ${i === FACTS.length - 1 ? "text-accent" : "text-on-navy"}`}>
                  {f.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ───────────── Right: the sign-in form ───────────── */}
      <section
        aria-label="Sign in"
        className="flex w-full min-w-0 flex-col px-gutter pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-10 lg:w-[44%] xl:p-16"
      >
        {/* Brand row + light/dark switch */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <LogoMark />
            <div className="min-w-0">
              <p className="font-display text-[18px] font-bold leading-tight tracking-tight text-ink">HR Dashboard</p>
              <p className="text-eyebrow uppercase text-ink-muted">People operations</p>
            </div>
          </div>
          <ThemeToggle className="size-tap lg:size-9" />
        </header>

        {/* Phones & tablets: the navy brand panel is hidden, so a compact navy
            band carries the tagline instead (mobile mockup). It's the page's
            <h1> on small screens; the desktop one is hidden there, so screen
            readers only ever meet one. */}
        <h1 className="mt-5 rounded-xl bg-navy px-4 py-4 text-headline-md text-on-navy lg:hidden">
          The people side of your company, in one <span className="text-accent">calm</span> place.
        </h1>

        <div className="mx-auto my-auto w-full max-w-[460px] py-6 sm:py-10">
          {DEMO_MODE ? (
            <>
              {/* Public demo: one click, no password */}
              <div className="mb-6">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-label-sm text-accent-ink">
                  <Sparkles className="h-3 w-3" aria-hidden /> Live demo
                </span>
                <h2 className="mt-3 text-headline-lg text-ink md:text-headline-xl">Explore HR Dashboard</h2>
                <p className="mt-2 text-body-md text-ink-muted">
                  Pick a role — no sign-up needed. Each role sees different pages and permissions. Sample data resets nightly.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {DEMO_ACCOUNTS.map((a) => (
                  <form key={a.role} action={demoLogin}>
                    <input type="hidden" name="role" value={a.role} />
                    <DemoRoleButton role={a.role} blurb={a.blurb} />
                  </form>
                ))}
              </div>
              <div className="my-7 flex items-center gap-3 text-center text-eyebrow uppercase text-ink-muted">
                <span className="h-px flex-1 bg-border" />
                or sign in with your account
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          ) : (
            <div className="mb-6 lg:mb-8">
              <span className="hidden rounded lg:inline-block bg-surface-2 px-2.5 py-1 text-eyebrow uppercase text-ink-muted">
                Workspace sign-in
              </span>
              <h2 className="text-headline-lg lg:mt-4 text-ink md:text-headline-xl">
                Welcome back<span className="lg:hidden">,</span>
              </h2>
              <p className="mt-2 text-body-md text-ink-muted">
                Sign in with your work credentials to access your team, leave, payroll and staff records.
              </p>
            </div>
          )}

          <form action={action} className="space-y-5">
            {/* Error banner — shown when the server action returns a message */}
            {state?.error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-critical/40 bg-critical/10 px-3 py-2.5 text-body-sm text-critical"
              >
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                {state.error}
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className={`mb-2 block ${fieldLabel}`}>
                Work email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                inputMode="email"
                required
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="next"
                defaultValue={isDev ? "admin@hrdashboard.com" : ""}
                placeholder="you@company.com"
                className={inputClass}
              />
            </div>

            {/* Password */}
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <label htmlFor="password" className={fieldLabel}>
                  Password
                </label>
                {/* No self-service reset yet — an Admin resets passwords on the Users page. */}
                <span className="text-body-sm text-ink-muted">Forgot it? Ask your admin</span>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  enterKeyHint="go"
                  defaultValue={isDev ? "password123" : ""}
                  placeholder="••••••••"
                  className={`${inputClass} pr-24`}
                />
                {/* Show / hide password toggle: a word ("Show") next to the icon, 48px tall */}
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex min-h-tap items-center gap-1.5 rounded-full px-3.5 text-eyebrow uppercase text-ink-muted transition-colors hover:text-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                  <span aria-hidden>{showPassword ? "Hide" : "Show"}</span>
                </button>
              </div>
            </div>

            {/* Session length note (sign-ins last 30 days) */}
            <div className="flex items-center justify-between gap-3 text-body-sm">
              <span className="flex items-center gap-2 text-ink-muted">
                <ShieldCheck className="h-4 w-4 shrink-0 text-ink" aria-hidden />
                You&apos;ll stay signed in for 30 days
              </span>
              <span className="hidden text-eyebrow uppercase text-ink-faint sm:inline">This device</span>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={pending}
              className="flex min-h-tap w-full items-center justify-center gap-2 rounded-full bg-accent px-4 text-label-md font-semibold text-on-accent transition-colors hover:bg-accent-hover active:bg-accent-pressed focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Signing in…
                </>
              ) : (
                <>
                  Sign in <ArrowRight className="h-4 w-4" aria-hidden />
                </>
              )}
            </button>
          </form>

          {/* Demo note — development only */}
          {isDev && (
            <p className="mt-4 rounded-lg border border-border bg-surface px-3 py-2 text-center text-body-sm text-ink-muted">
              Demo accounts — try <span className="text-ink [overflow-wrap:anywhere]">admin@hrdashboard.com</span> /{" "}
              <span className="text-ink">password123</span>
            </p>
          )}

          <p className="mt-8 text-center text-body-sm text-ink-muted">
            New here? <span className="text-ink">Ask your administrator for an account.</span>
          </p>
        </div>

        <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 text-body-sm text-ink-faint">
          <span>© {new Date().getFullYear()} HR Dashboard</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
            Encrypted passwords · Role-based access
          </span>
        </footer>
      </section>
    </main>
  );
}
