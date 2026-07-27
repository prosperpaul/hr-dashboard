"use client";

import { useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Users, Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, AlertCircle } from "lucide-react";
import { login } from "@/lib/auth-actions";

// Pre-fill demo credentials ONLY in development — never in production builds.
const isDev = process.env.NODE_ENV !== "production";

export default function LoginPage() {
  // Local state only for the password show/hide toggle now.
  const [showPassword, setShowPassword] = useState(false);

  // useActionState wires the form to our `login` server action.
  //  - state   : whatever the action returns (here, an optional error message)
  //  - action  : the function we hand to <form action={...}>
  //  - pending : true while the request is in flight (for the loading state)
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* ---------- Left: branding panel (hidden on small screens) ---------- */}
      <div className="relative hidden overflow-hidden border-r border-border bg-surface lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Soft accent glow in the background */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />

        {/* Brand */}
        <div className="relative flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent shadow-[0_0_24px_-2px_var(--color-accent)]">
            <Users className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-semibold text-ink">HR Dashboard</span>
        </div>

        {/* Headline */}
        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-ink">
            Everything your HR team needs, in one place.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-ink-muted">
            Manage people, track leave, run payroll, and get insights — all from a
            single modern dashboard built for growing teams.
          </p>

          <div className="mt-8 flex items-center gap-2 text-xs text-ink-muted">
            <ShieldCheck className="h-4 w-4 text-accent" />
            Enterprise-grade security &amp; role-based access
          </div>
        </div>

        <p className="relative text-xs text-ink-faint">
          © {new Date().getFullYear()} HR Dashboard. All rights reserved.
        </p>
      </div>

      {/* ---------- Right: the sign-in form ---------- */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Small logo shown only on mobile (left panel is hidden there) */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent">
              <Users className="h-5 w-5 text-white" />
            </div>
            <span className="text-base font-semibold text-ink">HR Dashboard</span>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-ink">Welcome back</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Sign in to your account to continue.
          </p>

          <form action={action} className="mt-8 space-y-4">
            {/* Error banner — shown when the server action returns a message */}
            {state?.error && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-lg border border-critical/40 bg-critical/10 px-3 py-2.5 text-sm text-critical"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                {state.error}
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  defaultValue={isDev ? "admin@hrdashboard.com" : ""}
                  placeholder="you@company.com"
                  className="w-full rounded-lg border border-border bg-bg py-2.5 pl-9 pr-3 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/40"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-ink">
                  Password
                </label>
                <Link href="#" className="text-xs text-accent hover:underline">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  defaultValue={isDev ? "password123" : ""}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-border bg-bg py-2.5 pl-9 pr-10 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/40"
                />
                {/* Show / hide password toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-ink-faint hover:text-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border bg-bg accent-[var(--color-accent)]"
              />
              Remember me for 30 days
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={pending}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white shadow-[0_0_24px_-6px_var(--color-accent)] transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Signing in…" : "Sign in"}
              {!pending && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          {/* Demo note — development only */}
          {isDev && (
            <p className="mt-4 rounded-lg border border-border bg-surface px-3 py-2 text-center text-xs text-ink-muted">
              Demo accounts — try <span className="text-ink">admin@hrdashboard.com</span> /{" "}
              <span className="text-ink">password123</span>
            </p>
          )}

          <p className="mt-6 text-center text-sm text-ink-muted">
            Don&apos;t have an account?{" "}
            <Link href="#" className="font-medium text-accent hover:underline">
              Contact your admin
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
