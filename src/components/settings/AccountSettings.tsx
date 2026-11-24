"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Check,
  X,
  Eye,
  EyeOff,
  Info,
  Lock,
  BadgeCheck,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  UserRound,
  KeyRound,
  ShieldCheck,
  Sun,
  Moon,
  Building2,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { updateMyName, changeMyPassword } from "@/lib/account-actions";
import { deptTint } from "@/lib/dept-tint";
import { buttonClass } from "@/components/ui/button";
import { inputClass } from "@/components/ui/form";
import { Segmented } from "@/components/ui/Chips";
import { useTheme, setTheme } from "@/components/ThemeToggle";
import { logout } from "@/lib/auth-actions";

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

const capsLabel = "text-eyebrow uppercase text-ink-muted";

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
      <div className="min-w-0">
        <h2 className="text-headline-md text-ink">{title}</h2>
        <p className="mt-1 text-body-sm text-ink-muted">{children}</p>
      </div>
      <span className={`shrink-0 pt-2 ${capsLabel}`}>Section {String(n).padStart(2, "0")}</span>
    </div>
  );
}

/*
  One row of the phone settings menu (mockup z27): a sunken icon tile, a
  title, a one-line description and a chevron. Tapping it opens that section.
*/
function MenuRow({ icon: Icon, title, detail, onClick }: { icon: LucideIcon; title: string; detail: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex min-h-tap w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-surface-2">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-sunken text-ink">
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-label-md font-semibold text-ink">{title}</span>
          <span className="block truncate text-body-sm text-ink-muted">{detail}</span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint" aria-hidden />
      </button>
    </li>
  );
}

// A labelled group of menu rows ("ACCOUNT", "PREFERENCES").
function MenuGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className={`px-1 ${capsLabel}`}>{title}</h2>
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface">{children}</ul>
    </section>
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
  // Phones/tablets only: which section is open from the settings menu
  // (null = show the menu). Desktop ignores this and shows every section.
  const [view, setView] = useState<string | null>(null);
  const theme = useTheme();
  function go(next: string | null) {
    setView(next);
    // A new "screen" on the phone should start at the top, like an app.
    window.scrollTo({ top: 0 });
  }
  // Below lg, hide every section except the one opened from the menu.
  const shown = (id: string) => (view === id ? "" : "max-lg:hidden");

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

  const input = inputClass;
  const readOnly = "flex min-h-tap w-full min-w-0 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3.5 text-body-md text-ink-muted lg:min-h-11";
  const label = "mb-1.5 flex items-center justify-between text-label-md font-semibold text-ink";
  const card = "rounded-xl border border-border bg-surface p-4 sm:p-6";
  // Jumping to a section (desktop nav) must clear the sticky top bar, so the
  // heading isn't hidden behind it. Phones show one section at a time.
  const section = "scroll-mt-[calc(var(--spacing-topbar)+1rem)] border-b border-border pb-10 last:border-0 max-lg:border-0 max-lg:pb-0";

  const department = account.employee?.department ?? null;
  const allowedCount = permissions.filter((p) => p.allowed).length;
  const memberSince = new Date(account.memberSince).toLocaleDateString("en-US", { month: "short", year: "numeric" });

  return (
    <div className="space-y-8 pb-24">
      {/* ── Phones/tablets: the settings MENU (mockup z27) ── */}
      {view === null && (
        <div className="space-y-6 lg:hidden">
          <header className="space-y-1">
            <h1 className="text-headline-lg text-ink">Settings</h1>
            <p className="text-body-md text-ink-muted">Manage your profile, password and preferences.</p>
          </header>

          {/* Profile card */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center gap-4">
              <div aria-hidden className={`grid size-14 shrink-0 place-items-center rounded-full font-display text-headline-sm text-ink ${deptTint(department)}`}>
                {initials(savedName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="truncate font-display text-headline-sm text-ink">{savedName}</span>
                  <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-eyebrow uppercase text-on-accent">{account.role}</span>
                </p>
                <p className="truncate text-body-sm text-ink-muted">{account.email}</p>
                {account.employee && (
                  <p className="truncate text-body-sm text-ink-faint">
                    {account.employee.title}
                    {department ? ` · ${department}` : ""}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <button type="button" onClick={() => go("profile")} className="-ml-1 inline-flex min-h-tap items-center gap-2 px-1 text-label-md font-semibold text-ink">
                Edit profile &amp; personal info
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              <span className="tnum rounded-full bg-sunken px-2.5 py-1 text-label-sm text-ink-muted">Since {memberSince}</span>
            </div>
          </div>

          <MenuGroup title="Account">
            <MenuRow
              icon={UserRound}
              title="Profile"
              detail={account.employee ? `${account.employee.title}${department ? ` · ${department}` : ""}` : "Your name and sign-in email"}
              onClick={() => go("profile")}
            />
            <MenuRow icon={KeyRound} title="Security" detail="Change your password" onClick={() => go("security")} />
            <MenuRow
              icon={ShieldCheck}
              title="Roles & permissions"
              detail={`${account.role} · ${allowedCount} of ${permissions.length} permissions`}
              onClick={() => go("permissions")}
            />
          </MenuGroup>

          <MenuGroup title="Preferences">
            <MenuRow
              icon={theme === "dark" ? Moon : Sun}
              title="Appearance"
              detail={`${theme === "dark" ? "Dark" : "Light"} mode active`}
              onClick={() => go("appearance")}
            />
            <MenuRow icon={Building2} title="Workspace" detail={workspace.map((w) => w.label).join(", ")} onClick={() => go("workspace")} />
          </MenuGroup>

          {/* Sign out posts to the same `logout` server action as the sidebar. */}
          <form action={logout}>
            <button
              type="submit"
              className="flex min-h-tap w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-label-md font-semibold text-critical transition-colors active:bg-critical/10"
            >
              <LogOut className="h-5 w-5" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      )}

      {/* Phones/tablets, inside a section: a back button to the menu */}
      {view !== null && (
        <button type="button" onClick={() => go(null)} className="-ml-2 inline-flex min-h-tap items-center gap-2 rounded-full px-2 text-label-md font-semibold text-ink lg:hidden">
          <ArrowLeft className="h-5 w-5" aria-hidden />
          Settings
        </button>
      )}

      {/* ── Editorial header (lg+) ── */}
      <section className="space-y-2 max-lg:hidden">
        <p className={`flex items-center gap-2 ${capsLabel}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden />
          System · Preferences &amp; controls
        </p>
        <h1 className="text-headline-lg text-ink md:text-headline-xl">Settings.</h1>
        <p className="text-body-md text-ink-muted">Manage your profile and password, and see what your role can access.</p>
      </section>

      <div className={`grid grid-cols-1 items-start gap-8 lg:grid-cols-[220px_1fr] ${view === null ? "max-lg:hidden" : ""}`}>
        {/* ── Section nav (jumps to each section) ── */}
        {/* lg+ only: the vertical list beside the content. (Phones and tablets
            use the settings menu above instead.) */}
        <nav
          aria-label="Settings sections"
          className="max-lg:hidden sticky top-topbar z-20 -mx-gutter bg-bg/95 px-gutter py-2 backdrop-blur md:-mx-8 md:px-8 lg:top-[calc(var(--spacing-topbar)+1rem)] lg:mx-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
        >
          <ul className="flex gap-2 overflow-x-auto [scrollbar-width:none] lg:block lg:space-y-0.5">
            {SECTIONS.map((s) => {
              const on = active === s.id;
              return (
                <li key={s.id} className="shrink-0">
                  <a
                    href={`#${s.id}`}
                    onClick={() => setActive(s.id)}
                    aria-current={on ? "true" : undefined}
                    className={[
                      "flex min-h-tap items-center justify-between gap-2 whitespace-nowrap rounded-full border px-4 text-label-md transition-colors",
                      "lg:min-h-0 lg:rounded-none lg:border-0 lg:border-l-2 lg:px-3 lg:py-2",
                      on
                        ? "border-accent bg-accent font-semibold text-on-accent lg:border-accent lg:bg-surface lg:font-normal lg:text-ink"
                        : "border-border bg-surface text-ink-muted hover:text-ink lg:border-transparent lg:bg-transparent lg:hover:bg-surface",
                    ].join(" ")}
                  >
                    {s.label}
                    {on && <span aria-hidden className="hidden h-1.5 w-1.5 rounded-full bg-accent lg:inline" />}
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
          <form id="profile" onSubmit={saveName} className={`${section} ${shown("profile")}`}>
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
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-eyebrow uppercase text-ink-muted">
                    <BadgeCheck className="h-3 w-3" aria-hidden /> Sign-in
                  </span>
                </p>
                <div className={readOnly}>
                  <span className="truncate [overflow-wrap:anywhere]">{account.email}</span>
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
                <div className={readOnly}>
                  <span className="truncate">{account.role}</span>
                </div>
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
              <Info className="h-4 w-4 shrink-0" aria-hidden /> Email, role and employee link are managed by an Admin on the User accounts page.
            </p>
            {nameMsg && <Message {...nameMsg} />}
          </form>

          {/* ── 02 Security ── */}
          <form id="security" onSubmit={savePassword} className={`${section} ${shown("security")}`}>
            <SectionHead n={2} title="Security & credentials">
              Change the password you sign in with.
            </SectionHead>

            <div className={card}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-label-md font-semibold text-ink">Update password</h3>
                  <p className="text-body-sm text-ink-muted">Use at least 8 characters. Longer, with a mix of letters, numbers and symbols, is better.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-pressed={show}
                  className="inline-flex min-h-tap items-center gap-1.5 rounded-full border border-border bg-surface px-4 text-label-sm text-ink transition-colors hover:bg-bg lg:min-h-8 lg:px-3"
                >
                  {show ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
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
                      {matches ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
                      {matches ? "Passwords match" : "Doesn't match yet"}
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={pwPending || !currentPw || newPw.length < 8 || !matches}
                  className={`${buttonClass("navy")} w-full sm:w-auto`}
                >
                  {pwPending ? "Updating…" : "Update password"}
                </button>
              </div>
              {pwMsg && <Message {...pwMsg} />}
            </div>
          </form>

          {/* ── 03 Roles & permissions ── */}
          <section id="permissions" className={`${section} ${shown("permissions")}`}>
            <SectionHead n={3} title="Roles & permissions">
              What the {account.role} role can do ({allowedCount} of {permissions.length}). Everyone can always manage their own leave, attendance and payslips.
            </SectionHead>
            <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
              {permissions.map((p) => (
                <li key={p.label} className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
                  <div className="min-w-0">
                    <p className={`text-label-md font-semibold ${p.allowed ? "text-ink" : "text-ink-muted"}`}>{p.label}</p>
                    <p className="text-body-sm text-ink-muted">{p.detail}</p>
                  </div>
                  {/* Read-only switch look: filled navy = allowed, empty = no access */}
                  <span className="flex shrink-0 items-center gap-2">
                    <span className={`hidden text-label-sm sm:inline ${p.allowed ? "text-ink" : "text-ink-faint"}`}>{p.allowed ? "Allowed" : "No access"}</span>
                    <span
                      role="img"
                      aria-label={p.allowed ? "Allowed" : "No access"}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full ${p.allowed ? "bg-navy" : "border border-border bg-surface-2"}`}
                    >
                      <span className={`absolute grid h-4 w-4 place-items-center rounded-full bg-surface ${p.allowed ? "left-6" : "left-1"}`}>
                        {!p.allowed && <Lock className="h-2.5 w-2.5 text-ink-faint" aria-hidden />}
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* ── 04 Workspace ── */}
          <section id="workspace" className={`${section} ${shown("workspace")}`}>
            <SectionHead n={4} title="Workspace">
              Company-wide rules this dashboard currently uses.
            </SectionHead>
            <dl className="divide-y divide-border rounded-xl border border-border bg-surface">
              {workspace.map((w) => (
                <div key={w.label} className="flex flex-col gap-1 px-4 py-4 sm:flex-row sm:px-5 sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <dt className="text-label-md font-semibold text-ink">{w.label}</dt>
                    <dd className="text-body-sm text-ink-muted">{w.hint}</dd>
                  </div>
                  <dd className="shrink-0 font-display text-label-md font-semibold text-ink">{w.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* ── Appearance (phones/tablets only; desktop has the theme
              button in the top bar) ── */}
          {view === "appearance" && (
            <section className="space-y-5 lg:hidden">
              <div>
                <h2 className="text-headline-md text-ink">Appearance</h2>
                <p className="mt-1 text-body-sm text-ink-muted">Choose light or dark mode. It&apos;s remembered on this device.</p>
              </div>
              <Segmented
                label="Theme"
                value={theme}
                onChange={(k) => setTheme(k === "dark" ? "dark" : "light")}
                options={[
                  { key: "light", label: "Light", icon: <Sun className="h-4 w-4" aria-hidden /> },
                  { key: "dark", label: "Dark", icon: <Moon className="h-4 w-4" aria-hidden /> },
                ]}
              />
            </section>
          )}
        </div>
      </div>

      {/* ── Floating "unsaved edits" bar — appears when the name has changed ── */}
      {nameDirty && (
        // Phones/tablets: floats just above the bottom tab bar (and the home-bar
        // safe area). lg+: no tab bar, so it sits near the bottom edge.
        <div className="fixed inset-x-gutter bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom)+0.75rem)] z-40 mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-xl bg-navy px-4 py-3 text-on-navy shadow-popover sm:px-5 lg:bottom-6">
          <p className="flex min-w-0 items-center gap-2 text-body-sm">
            <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />
            <span className="font-semibold">Unsaved edits</span>
            <span className="hidden text-on-navy-muted sm:inline">· Profile name changed</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setName(savedName)}
              className="min-h-tap rounded-full px-3 text-label-md text-on-navy-muted transition-colors hover:text-on-navy lg:min-h-9"
            >
              Discard
            </button>
            {/* `form="profile"` lets this button submit the profile form from outside it */}
            <button
              type="submit"
              form="profile"
              disabled={namePending || !nameValid}
              className="inline-flex min-h-tap items-center gap-1.5 rounded-full bg-accent px-4 text-label-md font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50 lg:min-h-9"
            >
              <Check className="h-4 w-4" aria-hidden />
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
      {ok ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden /> : <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />}
      {text}
    </p>
  );
}
