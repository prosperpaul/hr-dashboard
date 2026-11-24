/*
  Button styles as class strings, so links (<Link>) and <button>s can share
  them: <button className={buttonClass("primary")}>.

  Sizes: 48px tall on phones and tablets (thumb-friendly), 40px from lg up where a mouse
  is likely. `icon` variants are square.
*/
export type ButtonVariant = "primary" | "secondary" | "navy" | "ghost" | "danger";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-pressed",
  secondary: "border border-border-strong bg-surface text-ink hover:bg-surface-2",
  navy: "bg-navy text-on-navy hover:bg-navy-2",
  ghost: "text-ink-muted hover:bg-surface-2 hover:text-ink",
  danger: "border border-critical/40 bg-surface text-critical hover:bg-critical/10",
};

export function buttonClass(variant: ButtonVariant = "primary", opts: { icon?: boolean; block?: boolean } = {}) {
  return [
    "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full text-label-md font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50",
    opts.icon ? "size-tap lg:size-10" : "min-h-tap px-5 lg:min-h-10",
    opts.block ? "w-full" : "",
    VARIANTS[variant],
  ].join(" ");
}
