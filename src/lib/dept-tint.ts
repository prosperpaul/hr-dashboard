/*
  Department colour tints from the design system.
  Each department gets a soft pastel background (always with navy text),
  chosen from keywords in its name — e.g. "Engineering" → sky blue.
  Unknown names still get a stable colour: we hash the name so the same
  department is always the same tint.
*/
const TINTS = {
  peach: "bg-tint-peach", // People & Culture
  sky: "bg-tint-sky", // Engineering & Product
  rose: "bg-tint-rose", // Marketing & Brand
  sand: "bg-tint-sand", // Operations & Legal
  lilac: "bg-tint-lilac", // Finance & Strategy
} as const;

const RULES: [RegExp, keyof typeof TINTS][] = [
  [/people|hr|human|culture|talent/i, "peach"],
  [/engineer|product|tech|design|data|it\b/i, "sky"],
  [/market|brand|sales|growth|comms/i, "rose"],
  [/operat|legal|support|admin|logistic|customer/i, "sand"],
  [/financ|strateg|account|exec/i, "lilac"],
];

export function deptTint(name?: string | null): string {
  if (!name) return "bg-surface-2";
  for (const [re, key] of RULES) if (re.test(name)) return TINTS[key];
  const keys = Object.keys(TINTS) as (keyof typeof TINTS)[];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[keys[h % keys.length]];
}

// Full class list for a department pill: 24px tall, small caps label.
export function deptBadgeClass(name?: string | null): string {
  return `inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ink ${deptTint(name)}`;
}
