"use client";

import { useState } from "react";
import { useActionState } from "react";
import { Users, Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { login } from "@/lib/auth-actions";
import ThemeToggle from "@/components/ThemeToggle";

// Pre-fill demo credentials ONLY in development — never in production builds.
const isDev = process.env.NODE_ENV !== "production";

/*
  Sign-in page. Left: brand panel with an illustrative product preview
  (desktop only). Right: the actual form, wired to the `login` server action.
*/
export default function LoginPage() {
  // Local state only for the password show/hide toggle.
  const [showPassword, setShowPassword] = useState(false);

  // useActionState wires the form to our `login` server action.
  //  - state   : whatever the action returns (here, an optional error message)
  //  - action  : the function we hand to <form action={...}>
  //  - pending : true while the request is in flight (for the loading state)
  const [state, action, pending] = useActionState(login, undefined);

  const inputClass =
    "block h-11 w-full rounded-lg border border-border bg-surface pl-10 text-body-md text-ink placeholder:text-ink-faint outline-none transition-colors hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent";

  return (
    <main className="flex min-h-screen w-full overflow-x-hidden bg-bg">
      {/* ───────────── Left: brand + product preview (desktop only) ───────────── */}
      <section
        aria-label="About HR Dashboard"
        className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-surface p-10 lg:flex lg:w-[52%] xl:w-[54%] xl:p-14"
        // Faint 32px grid drawn with two thin gradients (mid-grey, so it works in light & dark).
        style={{
          backgroundImage:
            "linear-gradient(to right, rgb(128 128 128 / 0.07) 1px, transparent 1px), linear-gradient(to bottom, rgb(128 128 128 / 0.07) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      >
        {/* Soft emerald glows */}
        <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
        <div className="pointer-events-none absolute left-1/3 top-1/2 h-[500px] w-[500px] rounded-full bg-accent/[0.04] blur-[100px]" />

        {/* Brand */}
        <header className="relative flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-accent/25 bg-accent-soft">
            <Users className="h-5 w-5 text-accent-hover" />
          </div>
          <div>
            <p className="text-headline-sm text-ink">HR Dashboard</p>
            <p className="text-body-sm text-ink-faint">People operations platform</p>
          </div>
        </header>

        {/* Pitch + preview */}
        <div className="relative my-auto py-8">
          <div className="mb-8 max-w-xl">
            <h1 className="text-headline-lg text-ink xl:text-headline-xl">Everything your HR team needs, in one place.</h1>
            <p className="mt-3 max-w-lg text-body-lg text-ink-muted">
              Run payroll, approve leave, track attendance and grow your team — from one fast, focused dashboard.
            </p>
          </div>

          {/* Illustrative preview of the product (decorative, sample figures) */}
          <div
            aria-hidden
            className="relative max-w-xl overflow-hidden rounded-xl border border-border bg-surface p-5 shadow-modal xl:max-w-2xl"
          >
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
                <span className="text-label-md text-ink">Overview</span>
              </div>
              <span className="rounded-md border border-border bg-surface-2 px-2 py-0.5 text-label-sm text-ink-faint">Preview</span>
            </div>

            <div className="my-4 grid grid-cols-3 gap-3">
              {[
                { label: "Total staff", value: "148", note: "+4 this month", badge: "+2.8%" },
                { label: "New hires", value: "7", note: "Last 30 days", badge: "+2" },
                { label: "Open roles", value: "5", note: "2 in final rounds", badge: "Hiring" },
              ].map((k) => (
                <div key={k.label} className="rounded-lg border border-border bg-surface-2 p-3">
                  <div className="mb-1 flex items-center justify-between gap-1">
                    <span className="truncate text-label-sm uppercase tracking-wider text-ink-faint">{k.label}</span>
                    <span className="text-label-sm text-accent-hover">{k.badge}</span>
                  </div>
                  <p className="tnum text-metric-md font-semibold text-ink">{k.value}</p>
                  <p className="mt-0.5 text-body-sm text-ink-faint">{k.note}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border bg-surface-2/80 p-3.5">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-label-md text-ink">Headcount growth</span>
                <span className="rounded-full border border-accent/25 bg-accent-soft px-1.5 py-0.5 text-label-sm text-accent-hover">+25.4%</span>
              </div>
              <svg viewBox="0 0 400 70" preserveAspectRatio="none" className="h-16 w-full overflow-visible" fill="none">
                <defs>
                  <linearGradient id="loginChart" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0,58 C60,54 120,48 180,42 C240,36 300,26 350,14 L400,6 L400,70 L0,70 Z" fill="url(#loginChart)" />
                <path d="M0,58 C60,54 120,48 180,42 C240,36 300,26 350,14 L400,6" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
                <circle cx="350" cy="14" r="3.5" fill="var(--color-accent)" stroke="var(--color-bg)" strokeWidth="2" />
              </svg>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent-hover">CN</span>
                <span className="text-body-sm text-ink-muted">Chidi N. requested 5 days&apos; leave</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="rounded-md border border-border bg-surface px-2 py-0.5 text-label-sm text-ink-faint">Decline</span>
                <span className="rounded-md bg-accent px-2 py-0.5 text-label-sm font-semibold text-on-accent">Approve</span>
              </div>
            </div>
          </div>
        </div>

        <footer className="relative flex items-center justify-between border-t border-border pt-4 text-body-sm text-ink-faint">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" />
            Role-based access · Encrypted passwords
          </span>
          <span>© {new Date().getFullYear()} HR Dashboard</span>
        </footer>
      </section>

      {/* ───────────── Right: the sign-in form ───────────── */}
      <section aria-label="Sign in" className="relative flex w-full flex-col p-6 sm:p-10 lg:w-[48%] xl:w-[46%] xl:p-16">
        {/* Light/dark switch, top-right */}
        <ThemeToggle className="absolute right-4 top-4 sm:right-6 sm:top-6" />
        {/* Brand header for small screens (the left panel is hidden there) */}
        <header className="mb-6 flex items-center gap-3 border-b border-border pb-6 lg:hidden">
          <div className="grid h-9 w-9 place-items-center rounded-lg border border-accent/25 bg-accent-soft">
            <Users className="h-5 w-5 text-accent-hover" />
          </div>
          <div>
            <p className="text-label-md text-ink">HR Dashboard</p>
            <p className="text-body-sm text-ink-faint">People operations platform</p>
          </div>
        </header>

        <div className="mx-auto my-auto w-full max-w-[420px] py-4">
          <div className="mb-8">
            <h2 className="text-headline-lg text-ink md:text-headline-xl">Welcome back</h2>
            <p className="mt-2 text-body-md text-ink-muted">Enter your work credentials to access your dashboard.</p>
          </div>

          <form action={action} className="space-y-4">
            {/* Error banner — shown when the server action returns a message */}
            {state?.error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-critical/40 bg-critical/10 px-3 py-2.5 text-body-sm text-critical"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {state.error}
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-label-md text-ink-muted">
                Work email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  defaultValue={isDev ? "admin@hrdashboard.com" : ""}
                  placeholder="you@company.com"
                  className={`${inputClass} pr-4`}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="block text-label-md text-ink-muted">
                  Password
                </label>
                {/* No self-service reset yet — an Admin resets passwords on the Users page. */}
                <span className="text-body-sm text-ink-faint">Forgot it? Ask your admin</span>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  defaultValue={isDev ? "password123" : ""}
                  placeholder="••••••••"
                  className={`${inputClass} pr-11`}
                />
                {/* Show / hide password toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-md text-ink-faint transition-colors hover:text-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <p className="text-body-sm text-ink-faint">You&apos;ll stay signed in on this device for 30 days.</p>

            {/* Submit */}
            <button
              type="submit"
              disabled={pending}
              className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-label-md font-semibold text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_0_24px_-6px_var(--color-accent)] transition-colors hover:bg-accent-hover active:bg-accent-pressed focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                </>
              ) : (
                <>
                  Sign in to Dashboard <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Demo note — development only */}
          {isDev && (
            <p className="mt-4 rounded-lg border border-border bg-surface px-3 py-2 text-center text-body-sm text-ink-muted">
              Demo accounts — try <span className="text-ink">admin@hrdashboard.com</span> /{" "}
              <span className="text-ink">password123</span>
            </p>
          )}

          <p className="mt-8 text-center text-body-sm text-ink-faint">
            Don&apos;t have an account? Accounts are created by your workspace admin.
          </p>
        </div>
      </section>
    </main>
  );
}
