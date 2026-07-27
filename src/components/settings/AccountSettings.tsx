"use client";

import { useState, useTransition } from "react";
import { User, KeyRound, CheckCircle2 } from "lucide-react";
import { updateMyName, changeMyPassword } from "@/lib/account-actions";

type AccountInfo = {
  name: string;
  email: string;
  role: string;
  employeeName: string | null;
};

export default function AccountSettings({ account }: { account: AccountInfo }) {
  const [name, setName] = useState(account.name);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [namePending, startNameTransition] = useTransition();

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwPending, startPwTransition] = useTransition();

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

  const inputClass =
    "w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/40";
  const labelClass = "mb-1.5 block text-sm font-medium text-ink";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink-muted">Manage your account.</p>
      </div>

      {/* Account overview */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-ink">Account</h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-ink-faint">Email</dt>
            <dd className="text-sm text-ink">{account.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">Role</dt>
            <dd className="text-sm text-ink">{account.role}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">Employee record</dt>
            <dd className="text-sm text-ink">{account.employeeName ?? "Not linked"}</dd>
          </div>
        </dl>
      </div>

      {/* Profile: name */}
      <form onSubmit={saveName} className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-ink">Profile</h2>
        </div>
        <div className="mt-4 max-w-sm">
          <label className={labelClass} htmlFor="displayName">Display name</label>
          <input
            id="displayName"
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        {nameMsg && <Message {...nameMsg} />}
        <div className="mt-4">
          <button
            type="submit"
            disabled={namePending || name.trim() === account.name}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {namePending ? "Saving…" : "Save name"}
          </button>
        </div>
      </form>

      {/* Password */}
      <form onSubmit={savePassword} className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-ink">Password</h2>
        </div>
        <div className="mt-4 grid max-w-sm gap-4">
          <div>
            <label className={labelClass} htmlFor="currentPw">Current password</label>
            <input
              id="currentPw"
              type="password"
              autoComplete="current-password"
              className={inputClass}
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="newPw">New password</label>
            <input
              id="newPw"
              type="password"
              autoComplete="new-password"
              className={inputClass}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="confirmPw">Confirm new password</label>
            <input
              id="confirmPw"
              type="password"
              autoComplete="new-password"
              className={inputClass}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
            />
          </div>
        </div>
        {pwMsg && <Message {...pwMsg} />}
        <div className="mt-4">
          <button
            type="submit"
            disabled={pwPending || !currentPw || !newPw || !confirmPw}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            {pwPending ? "Updating…" : "Update password"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Message({ ok, text }: { ok: boolean; text: string }) {
  return (
    <p
      className={[
        "mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
        ok
          ? "border-good/40 bg-good/10 text-good"
          : "border-critical/40 bg-critical/10 text-critical",
      ].join(" ")}
    >
      {ok && <CheckCircle2 className="h-4 w-4 shrink-0" />}
      {text}
    </p>
  );
}
