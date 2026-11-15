"use client";

import { useState, useTransition } from "react";
import { User, KeyRound, ShieldCheck, Building2, CheckCircle2, AlertCircle, Check, X, Eye, EyeOff, Mail, BadgeCheck, Lock } from "lucide-react";
import { updateMyName, changeMyPassword } from "@/lib/account-actions";
import { Pill } from "@/components/dashboard/Panel";

type AccountInfo = {
  name: string;
  email: string;
  role: string;
  memberSince: string; // ISO
  employee: { name: string; title: string; department: string | null } | null;
};
type Permission = { label: string; detail: string; allowed: boolean };
type WorkspaceSetting = { label: string; value: string; hint: string };

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Security", icon: KeyRound },
  { id: "permissions", label: "Roles & permissions", icon: ShieldCheck },
  { id: "workspace", label: "Workspace", icon: Building2 },
];

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";

/*
  Password strength, 0–4. The server's only hard rule is "8+ characters and
  different from the current one"; the rest is guidance: longer passwords and
  a mix of character types are much harder to guess.
*/
function strength(pw: string): { score: number; label: string } {
  if (!pw) return { score: 0, label: "" };
  if (pw.length < 8) return { score: 1, label: "Too short" };
  const variety = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
  const score = Math.min(4, 1 + (pw.length >= 12 ? 1 : 0) + (variety >= 3 ? 1 : 0) + (variety === 4 || pw.length >= 16 ? 1 : 0));
  return { score, label: ["", "Weak", "Fair", "Good", "Strong"][score] };
}

export default function AccountSettings({
  account,
  permissions,
  workspace,
}: {
  account: AccountInfo;
  permissions: Permission[];
  workspace: WorkspaceSetting[];
}) {
  const [active, setActive] = useState("profile");

  // Profile
  const [name, setName] = useState(account.name);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [namePending, startNameTransition] = useTransition();

  // Password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [show, setShow] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwPending, startPwTransition] = useTransition();
  const pwStrength = strength(newPw);
  const matches = confirmPw.length > 0 && confirmPw === newPw;

  function saveName(e: React.FormEvent) {
    e.preventDefault();
    setNameMsg(null);
    startNameTransition(async () => {
      try {
        await updateMyName(name);
        setNameMsg({ ok: true, text: "Name updated. It'll show everywhere after your next sign-in." });
      } catch (err) {
        setNameMsg({ ok: false, text: err instanceof Error ? err.message : "Could not update name." });
      }
    });
  }

  function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== confirmPw) {
      setPwMsg({ ok: false, text: "New password and confirmation don't match." });
      return;
    }
    startPwTransition(async () => {
      try {
        await changeMyPassword(currentPw, newPw);
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
        setPwMsg({ ok: true, text: "Password changed successfully." });
      } catch (err) {
        setPwMsg({ ok: false, text: err instanceof Error ? err.message : "Could not change password." });
      }
    });
  }

  const input =
    "h-10 w-full rounded-lg border border-border bg-surface-2 px-3 text-body-md text-ink placeholder:text-ink-faint outline-none transition-colors hover:border-border-strong focus:border-accent focus:ring-1 focus:ring-accent";
  const readOnly = "flex h-10 w-full items-center gap-2 rounded-lg border border-border bg-bg/60 px-3 text-body-md text-ink-muted";
  const label = "mb-1.5 flex items-center justify-between text-label-sm uppercase tracking-wider text-ink-faint";
  const card = "scroll-mt-6 rounded-xl border border-border bg-surface p-5 sm:p-6";
  const primaryBtn =
    "inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-label-md font-semibold text-on-accent shadow-[inset_0_1px_0_rgb(255_255_255/0.2)] transition-colors hover:bg-accent-hover active:bg-accent-pressed disabled:opacity-50";

  const allowedCount = permissions.filter((p) => p.allowed).length;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <section className="space-y-1">
        <div className="flex items-center gap-2 text-label-sm uppercase tracking-wider text-ink-faint">
          <span>System</span>
          <span>/</span>
          <span className="normal-case tracking-normal text-accent-hover">Settings</span>
        </div>
        <h1 className="text-headline-lg text-ink md:text-headline-xl">Settings</h1>
        <p className="text-body-md text-ink-muted">Manage your profile, password and see what your role can access.</p>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[240px_1fr]">
        {/* ── Section nav (jumps to each card) ── */}
        <nav className="rounded-xl border border-border bg-surface p-2 lg:sticky lg:top-4">
          <p className="px-3 pb-2 pt-2 text-label-sm uppercase tracking-wider text-ink-faint">Account &amp; workspace</p>
          <ul className="flex gap-1 overflow-x-auto lg:block lg:space-y-0.5">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const on = active === s.id;
              return (
                <li key={s.id} className="shrink-0">
                  <a
                    href={`#${s.id}`}
                    onClick={() => setActive(s.id)}
                    className={[
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-label-md transition-colors",
                      on ? "bg-surface-2 text-ink" : "text-ink-muted hover:bg-surface-2 hover:text-ink",
                    ].join(" ")}
                  >
                    <Icon className={`h-4 w-4 ${on ? "text-accent" : "text-ink-faint"}`} />
                    <span className="whitespace-nowrap">{s.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 hidden border-t border-border px-3 pb-2 pt-3 lg:block">
            <p className="text-label-sm uppercase tracking-wider text-ink-faint">Session</p>
            <p className="mt-1.5 flex items-center gap-2 text-body-sm text-ink-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
              Signed in as {account.role}
            </p>
          </div>
        </nav>

        <div className="space-y-6">
          {/* ── Profile ── */}
          <form id="profile" onSubmit={saveName} className={card}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-headline-md text-ink">Personal Information</h2>
                <p className="text-body-sm text-ink-faint">How you appear across the dashboard.</p>
              </div>
              <Pill tone="accent" dot>
                Member since {new Date(account.memberSince).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
              </Pill>
            </div>

            <div className="mt-5 flex items-center gap-4 rounded-lg border border-border bg-bg/50 p-4">
              <div className="relative grid h-16 w-16 shrink-0 place-items-center rounded-full border border-accent/30 bg-accent-soft text-headline-md text-accent-hover">
                {initials(name || account.name)}
                <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-surface bg-accent">
                  <Check className="h-3 w-3 text-on-accent" />
                </span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-headline-sm text-ink">{account.name}</p>
                <p className="truncate text-body-sm text-ink-faint">
                  {account.employee ? `${account.employee.title}${account.employee.department ? ` · ${account.employee.department}` : ""}` : account.role}
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="displayName" className={label}>
                  Display name
                </label>
                <input id="displayName" className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
              <div>
                <p className={label}>
                  Sign-in email
                  <span className="flex items-center gap-1 normal-case tracking-normal text-accent-hover">
                    <BadgeCheck className="h-3 w-3" /> Account email
                  </span>
                </p>
                <div className={readOnly}>
                  <Mail className="h-4 w-4 text-ink-faint" />
                  <span className="truncate">{account.email}</span>
                </div>
              </div>
              <div>
                <p className={label}>Access role</p>
                <div className={readOnly}>
                  <ShieldCheck className="h-4 w-4 text-ink-faint" />
                  {account.role}
                </div>
              </div>
              <div>
                <p className={label}>Employee record</p>
                <div className={readOnly}>
                  <User className="h-4 w-4 text-ink-faint" />
                  <span className="truncate">{account.employee ? account.employee.name : "Not linked"}</span>
                </div>
              </div>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-body-sm text-ink-faint">
              <Lock className="h-3 w-3" /> Email, role and employee link are managed by an Admin on the User accounts page.
            </p>

            {nameMsg && <Message {...nameMsg} />}
            <div className="mt-5 flex justify-end border-t border-border pt-4">
              <button type="submit" disabled={namePending || name.trim() === account.name || name.trim().length < 2} className={primaryBtn}>
                <Check className="h-4 w-4" />
                {namePending ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>

          {/* ── Security ── */}
          <form id="security" onSubmit={savePassword} className={card}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-headline-md text-ink">Security &amp; Password</h2>
                <p className="text-body-sm text-ink-faint">Use at least 8 characters. Longer, with a mix of letters, numbers and symbols, is better.</p>
              </div>
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-label-sm text-ink-muted transition-colors hover:border-border-strong hover:text-ink"
              >
                {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {show ? "Hide" : "Show"} passwords
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label htmlFor="currentPw" className={label}>
                  Current password
                </label>
                <input id="currentPw" type={show ? "text" : "password"} autoComplete="current-password" className={input} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
              </div>
              <div>
                <label htmlFor="newPw" className={label}>
                  New password
                  {pwStrength.label && (
                    <span className={`normal-case tracking-normal ${pwStrength.score >= 3 ? "text-accent-hover" : pwStrength.score === 2 ? "text-warning" : "text-critical"}`}>
                      {pwStrength.label}
                    </span>
                  )}
                </label>
                <input id="newPw" type={show ? "text" : "password"} autoComplete="new-password" className={input} value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="At least 8 characters" />
                {/* 4-segment strength meter */}
                <div className="mt-2 grid grid-cols-4 gap-1" aria-hidden>
                  {[1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className={`h-1 rounded-full ${
                        i <= pwStrength.score ? (pwStrength.score >= 3 ? "bg-accent" : pwStrength.score === 2 ? "bg-warning" : "bg-critical") : "bg-surface-2"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="confirmPw" className={label}>
                  Confirm password
                </label>
                <input id="confirmPw" type={show ? "text" : "password"} autoComplete="new-password" className={input} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
                {confirmPw && (
                  <p className={`mt-2 flex items-center gap-1 text-body-sm ${matches ? "text-accent-hover" : "text-critical"}`}>
                    {matches ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {matches ? "Passwords match" : "Doesn't match yet"}
                  </p>
                )}
              </div>
            </div>

            {pwMsg && <Message {...pwMsg} />}
            <div className="mt-5 flex justify-end border-t border-border pt-4">
              <button type="submit" disabled={pwPending || !currentPw || newPw.length < 8 || !matches} className={primaryBtn}>
                <KeyRound className="h-4 w-4" />
                {pwPending ? "Updating…" : "Update password"}
              </button>
            </div>
          </form>

          {/* ── Roles & permissions ── */}
          <section id="permissions" className={card}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-headline-md text-ink">Roles &amp; Permissions</h2>
                <p className="text-body-sm text-ink-faint">What the {account.role} role can do. Everyone can always manage their own leave, attendance and payslips.</p>
              </div>
              <Pill tone="accent">
                {allowedCount} of {permissions.length} enabled
              </Pill>
            </div>
            <ul className="mt-5 divide-y divide-border rounded-lg border border-border">
              {permissions.map((p) => (
                <li key={p.label} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${p.allowed ? "border-accent/30 bg-accent-soft" : "border-border bg-bg"}`}>
                      {p.allowed ? <Check className="h-4 w-4 text-accent-hover" /> : <Lock className="h-3.5 w-3.5 text-ink-faint" />}
                    </span>
                    <div className="min-w-0">
                      <p className={`text-label-md ${p.allowed ? "text-ink" : "text-ink-muted"}`}>{p.label}</p>
                      <p className="truncate text-body-sm text-ink-faint">{p.detail}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 text-label-sm ${p.allowed ? "text-accent-hover" : "text-ink-faint"}`}>{p.allowed ? "Allowed" : "No access"}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* ── Workspace ── */}
          <section id="workspace" className={card}>
            <div>
              <h2 className="text-headline-md text-ink">Workspace</h2>
              <p className="text-body-sm text-ink-faint">Company-wide rules this dashboard currently uses.</p>
            </div>
            <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {workspace.map((w) => (
                <div key={w.label} className="rounded-lg border border-border bg-bg/50 p-4">
                  <dt className="text-label-sm uppercase tracking-wider text-ink-faint">{w.label}</dt>
                  <dd className="mt-1 text-headline-sm text-ink">{w.value}</dd>
                  <dd className="text-body-sm text-ink-faint">{w.hint}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}

function Message({ ok, text }: { ok: boolean; text: string }) {
  return (
    <p
      role={ok ? "status" : "alert"}
      className={[
        "mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-body-sm",
        ok ? "border-accent/30 bg-accent-soft text-accent-hover" : "border-critical/40 bg-critical/10 text-critical",
      ].join(" ")}
    >
      {ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
      {text}
    </p>
  );
}
