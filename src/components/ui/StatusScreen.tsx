import type { LucideIcon } from "lucide-react";

/*
  StatusScreen — the shared layout for "system" pages: something broke,
  page not found, or your role can't open this section.

  One centred card: a big icon in a soft circle, an optional small pill
  (e.g. "Your role: …"), a headline, one reassuring sentence, the actions
  (stacked full-width on phones, side by side from sm up) and an optional
  small footnote (e.g. an error reference).

  No "use client" — works in server pages AND in client files like error.tsx.
*/
const TONES = {
  critical: "bg-critical/10 text-critical",
  accent: "bg-accent-soft text-accent-ink",
  neutral: "bg-sunken text-navy",
} as const;

export default function StatusScreen({
  icon: Icon,
  tone = "neutral",
  eyebrow,
  badge,
  title,
  description,
  actions,
  footnote,
  headingLevel = "h1",
}: {
  icon: LucideIcon;
  tone?: keyof typeof TONES;
  eyebrow?: string;
  badge?: React.ReactNode; // small pill above the headline
  title: string;
  description: React.ReactNode;
  actions: React.ReactNode;
  footnote?: React.ReactNode;
  headingLevel?: "h1" | "h2";
}) {
  const Heading = headingLevel;
  return (
    // py keeps the card off the top bar; on big screens it sits a little
    // lower so it reads as the "main thing" on an otherwise empty page.
    <div className="flex justify-center py-6 md:py-12">
      <section className="flex w-full max-w-lg flex-col items-center rounded-xl border border-border bg-surface px-5 py-8 text-center md:px-10 md:py-12">
        <span className={`grid size-16 place-items-center rounded-full ${TONES[tone]}`}>
          <Icon className="size-8" aria-hidden />
        </span>
        {eyebrow && <p className="mt-5 text-eyebrow uppercase text-ink-muted">{eyebrow}</p>}
        {badge && (
          <p className="mt-5 max-w-full rounded-full bg-sunken px-4 py-1.5 text-label-sm text-ink-muted [overflow-wrap:anywhere]">
            {badge}
          </p>
        )}
        <Heading className={`${eyebrow || badge ? "mt-2" : "mt-5"} text-headline-lg text-ink text-balance`}>{title}</Heading>
        <p className="mt-2 max-w-sm text-body-md text-ink-muted">{description}</p>
        {/* Phones: full-width stacked buttons (easy thumb targets). sm+: a row. */}
        <div className="mt-6 flex w-full max-w-xs flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center">{actions}</div>
        {footnote && (
          <p className="mt-6 max-w-full rounded-full bg-sunken px-4 py-1.5 text-label-sm text-ink-muted [overflow-wrap:anywhere]">
            {footnote}
          </p>
        )}
      </section>
    </div>
  );
}
