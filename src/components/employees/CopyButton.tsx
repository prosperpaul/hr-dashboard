"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/*
  A small "copy to clipboard" icon button (used for the work email on the
  phone profile). It's a 48px target, swaps to a tick for two seconds after
  copying, and announces "Copied" to screen readers.
*/
export default function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (e.g. insecure context) — nothing else to do.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : label}
      className="grid size-tap shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
    >
      {copied ? <Check className="h-4 w-4 text-good" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}
