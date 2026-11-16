/*
  Small date helpers shared by the employee directory and the profile page.
  Dates are stored as plain "YYYY-MM-DD" strings (no time zone involved), so
  we build Date objects from the parts instead of letting the browser guess.
*/

// "2024-11-04" -> a Date for that calendar day.
export function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

// "2024-11-04" -> "Nov 4, 2024"
export function formatDate(iso: string): string {
  const d = parseDay(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// "2024-11-04" -> "Nov 2024"
export function formatMonthYear(iso: string): string {
  const d = parseDay(iso);
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

// Whole months between two days (never negative).
export function monthsBetween(start: string, today: string): number {
  const a = parseDay(start);
  const b = parseDay(today);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months--;
  return Math.max(0, months);
}

// How long someone has worked here: "2y 3m", "5m", "New".
export function tenure(start: string, today: string): string {
  const months = monthsBetween(start, today);
  if (months < 1) return "New";
  const y = Math.floor(months / 12);
  const m = months % 12;
  return y ? `${y}y${m ? ` ${m}m` : ""}` : `${m}m`;
}
