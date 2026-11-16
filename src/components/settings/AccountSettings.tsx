"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, AlertCircle, Check, X, Eye, EyeOff, Info, Lock, BadgeCheck } from "lucide-react";
import { updateMyName, changeMyPassword } from "@/lib/account-actions";
import { deptTint } from "@/lib/dept-tint";

type AccountInfo = {
  name: string;
  email: string;
  role: string;
  memberSince: string; // ISO
  employee: { name: string; title: string; department: string | null } | null;
};
type Permission = { label: string; detail: string; allowed: boolean };
type WorkspaceSetting = { label: string; value: string; hint: string };

// The left-hand section list. Each entry jumps to the matching section below.
const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "permissions", label: "Roles & permissions" },
  { id: "workspace", label: "Workspace" },
];

const capsLabel = "text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted";

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

/*
  A section heading in the mockup's editorial style: title + one-line
  description on the left, "SECTION 0N" marker on the right.
*/
function SectionHead({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-headline-md text-ink">{title}</h2>
        <p className="mt-1 text-body-sm text-ink-muted">{children}</p>
      </div>
      <span className={`shrink-0 pt-2 ${capsLabel}`}>Section {String(n).padStart(2, "0")}</span>
    </div>
  );
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
  // `savedName` = the name as last saved, so we know when there are unsaved edits.
  const [savedName, setSavedName] = useState(account.name);
  const [name, setName] = useState(account.name);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [namePending, startNameTransition] = useTransition();
  const nameDirty = name.trim() !== savedName;
  const nameValid = name.trim().length >= 2;

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
        setSavedName(name.trim());
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
    "h-11 w-full rounded-lg border border-border bg-surface px-3 text-body-md text-ink placeholder:text-ink-faint outline-none transition-colors hover:border-border-strong focus:border-ink focus:ring-1 focus:ring-ink";
  const readOnly = "flex h-11 w-full items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 text-body-md text-ink-muted";
  const label = "mb-1.5 flex items-center justify-between text-label-md font-semibold text-ink";
  const card = "rounded-xl border border-border bg-surface p-5 sm:p-6";
  const section = "scroll-mt-6 border-b border-border pb-10 last:border-0";

  const department = account.employee?.department ?? null;
  const allowedCount = permissions.filter((p) => p.allowed).length;
  const memberSince = new Date(account.memberSince).toLocaleDateString("en-US", { month: "short", year: "numeric" });

  return (
    <div className="space-y-8 pb-24">
      {/* ── Editorial header ── */}
      <section className="space-y-2">
        <p className={`flex items-center gap-2 ${capsLabel}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-ink" />
          System · Preferences &amp; controls
        </p>
        <h1 className="text-headline-lg text-ink md:text-headline-xl">Settings.</h1>
        <p className="text-body-md text-ink-muted">Manage your profile and password, and see what your role can access.</p>
      </section>

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[220px_1fr]">
        {/* ── Section nav (jumps to each section) ── */}
        <nav className="lg:sticky lg:top-4">
          <ul className="flex gap-1 overflow-x-auto lg:block lg:space-y-0.5">
            {SECTIONS.map((s) => {
              const on = active === s.id;
              return (
                <li key={s.id} className="shrink-0">
                  <a
                    href={`#${s.id}`}
                    onClick={() => setActive(s.id)}
                    className={[
                      "flex items-center justify-between gap-2 whitespace-nowrap border-l-2 px-3 py-2 text-label-md transition-colors",
                      on ? "border-accent bg-surface text-ink" : "border-transparent text-ink-muted hover:bg-surface hover:text-ink",
                    ].join(" ")}
                  >
                    {s.label}
                    {on && <span className="hidden h-1.5 w-1.5 rounded-full bg-accent lg:inline" />}
                  </a>
                </li>
              );
            })}
          </ul>
          {/* Session note (replaces the mockup's governance note with real info) */}
          <div className="mt-6 hidden border-t border-border pt-4 lg:block">
            <p className={capsLabel}>Your session</p>
            <p className="mt-2 text-body-sm text-ink-muted">
              Signed in as <span className="text-ink">{account.role}</span>. Member since {memberSince}.
            </p>
          </div>
        </nav>

        <div className="min-w-0 space-y-10">
          {/* ── 01 Profile ── */}
          <form id="profile" onSubmit={saveName} className={section}>
            <SectionHead n={1} title="Personal profile">
              How you appear across the dashboard.
            </SectionHead>

            <div className={card}>
              <div className="flex items-center gap-4">
                <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-full font-display text-headline-sm text-ink ${deptTint(department)}`}>
                  {initials(name || account.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-label-md font-semibold text-ink">{savedName}</p>
                  <p className="truncate text-body-sm text-ink-muted">
                    {account.employee ? `${account.employee.title}${department ? ` · ${department}` : ""}` : account.role}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="displayName" className={label}>
                  Full name
                </label>
                <input id="displayName" className={input} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </div>
              <div>
                <p className={label}>
                  Work email
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                    <BadgeCheck className="h-3 w-3" /> Sign-in
                  </span>
                </p>
                <div className={readOnly}>
                  <span className="truncate">{account.email}</span>
                </div>
              </div>
              <div>
                <p className={label}>Role / title</p>
                <div className={readOnly}>
                  <span className="truncate">{account.employee?.title ?? "—"}</span>
                </div>
              </div>
              <div>
                <p className={label}>Access role</p>
                <div className={readOnly}>{account.role}</div>
              </div>
              <div>
                <p className={label}>Department</p>
                <div className={readOnly}>
                  <span className="truncate">{department ?? "—"}</span>
                </div>
              </div>
              <div>
                <p className={label}>Employee record</p>
                <div className={readOnly}>
                  <span className="truncate">{account.employee ? account.employee.name : "Not linked"}</span>
                </div>
              </div>
            </div>

            <p className="mt-4 flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2.5 text-body-sm text-ink-muted">
              <Info className="h-4 w-4 shrink-0" /> Email, role and employee link are managed by an Admin on the User accounts page.
            </p>
            {nameMsg && <Message {...nameMsg} />}
          </form>

          {/* ── 02 Security ── */}
          <form id="security" onSubmit={savePassword} className={section}>
            <SectionHead n={2} title="Security & credentials">
              Change the password you sign in with.
            </SectionHead>

            <div className={card}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-label-md font-semibold text-ink">Update password</h3>
                  <p className="text-body-sm text-ink-muted">Use at least 8 characters. Longer, with a mix of letters, numbers and symbols, is better.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-label-sm text-ink transition-colors hover:bg-bg"
                >
                  {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {show ? "Hide" : "Show"} passwords
                </button>
              </div>

              <div className="mt-5 space-y-4">
                <div className="sm:max-w-[calc(50%-0.5rem)]">
                  <label htmlFor="currentPw" className={label}>
                    Current password
                  </label>
                  <input id="currentPw" type={show ? "text" : "password"} autoComplete="current-password" className={input} value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="newPw" className={label}>
                      New password
                    </label>
                    <input id="newPw" type={show ? "text" : "password"} autoComplete="new-password" className={input} value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="At least 8 characters" />
                  </div>
                  <div>
                    <label htmlFor="confirmPw" className={label}>
                      Confirm new password
                    </label>
                    <input id="confirmPw" type={show ? "text" : "password"} autoComplete="new-password" className={input} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
                  </div>
                </div>
              </div>

              {/* 4-segment strength meter */}
              <div className="mt-5 grid grid-cols-4 gap-1.5" aria-hidden>
                {[1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={`h-1 rounded-full ${
                      i <= pwStrength.score ? (pwStrength.score >= 3 ? "bg-ink" : pwStrength.score === 2 ? "bg-warning" : "bg-critical") : "bg-surface-2"
                    }`}
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm">
                  <span className={pwStrength.score >= 3 ? "text-ink" : pwStrength.score === 2 ? "text-warning" : pwStrength.score ? "text-critical" : "text-ink-faint"}>
                    {pwStrength.label ? `Strength: ${pwStrength.label}` : "Strength: —"}
                  </span>
                  {confirmPw && (
                    <span className={`flex items-center gap-1 ${matches ? "text-good" : "text-critical"}`}>
                      {matches ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                      {matches ? "Passwords match" : "Doesn't match yet"}
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={pwPending || !currentPw || newPw.length < 8 || !matches}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full bg-navy px-5 text-label-md font-semibold text-on-navy transition-colors hover:bg-navy-2 disabled:opacity-50"
                >
                  {pwPending ? "Updating…" : "Update password"}
                </button>
              </div>
              {pwMsg && <Message {...pwMsg} />}
            </div>
          </form>

          {/* ── 03 Roles & permissions ── */}
          <section id="permissions" className={section}>
            <SectionHead n={3} title="Roles & permissions">
              What the {account.role} role can do ({allowedCount} of {permissions.length}). Everyone can always manage their own leave, attendance and payslips.
            </SectionHead>
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {permissions.map((p) => (
                <li key={p.label} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className={`text-label-md font-semibold ${p.allowed ? "text-ink" : "text-ink-muted"}`}>{p.label}</p>
                    <p className="text-body-sm text-ink-muted">{p.detail}</p>
                  </div>
                  {/* Read-only switch look: filled navy = allowed, empty = no access */}
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={`hidden text-label-sm sm:inline ${p.allowed ? "text-ink" : "text-ink-faint"}`}>{p.allowed ? "Allowed" : "No access"}</span>
                    <span
                      aria-label={p.allowed ? "Allowed" : "No access"}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full ${p.allowed ? "bg-navy" : "border border-border bg-surface-2"}`}
                    >
                      <span className={`absolute grid h-4 w-4 place-items-center rounded-full bg-surface ${p.allowed ? "left-6" : "left-1"}`}>
                        {!p.allowed && <Lock className="h-2.5 w-2.5 text-ink-faint" />}
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* ── 04 Workspace ── */}
          <section id="workspace" className={section}>
            <SectionHead n={4} title="Workspace">
              Company-wide rules this dashboard currently uses.
            </SectionHead>
            <dl className="divide-y divide-border rounded-xl border border-border bg-surface">
              {workspace.map((w) => (
                <div key={w.label} className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <dt className="text-label-md font-semibold text-ink">{w.label}</dt>
                    <dd className="text-body-sm text-ink-muted">{w.hint}</dd>
                  </div>
                  <dd className="shrink-0 font-display text-label-md font-semibold text-ink">{w.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>

      {/* ── Floating "unsaved edits" bar — appears when the name has changed ── */}
      {nameDirty && (
        <div className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-xl bg-navy px-5 py-3 text-on-navy shadow-popover">
          <p className="flex items-center gap-2 text-body-sm">
            <span className="h-2 w-2 rounded-full bg-[#f5c518]" />
            <span className="font-semibold">Unsaved edits</span>
            <span className="text-on-navy-muted">· Profile name changed</span>
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setName(savedName)} className="h-9 rounded-full px-3 text-label-md text-on-navy-muted transition-colors hover:text-on-navy">
              Discard
            </button>
            {/* `form="profile"` lets this button submit the profile form from outside it */}
            <button
              type="submit"
              form="profile"
              disabled={namePending || !nameValid}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-label-md font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {namePending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Message({ ok, text }: { ok: boolean; text: string }) {
  return (
    <p
      role={ok ? "status" : "alert"}
      className={[
        "mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-body-sm",
        ok ? "border-good/30 bg-good/10 text-good" : "border-critical/40 bg-critical/10 text-critical",
      ].join(" ")}
    >
      {ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
      {text}
    </p>
  );
}
