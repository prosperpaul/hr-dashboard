/*
  Shared attendance constants, types, and helpers. Pure (no server imports) so
  both the server actions and client components can use them.
*/

export const ATTENDANCE_STATUSES = ["Present", "Late", "Absent", "Remote"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

// Anyone clocking in after this time-of-day is marked "Late".
export const LATE_AFTER_MINUTES = 9 * 60 + 15; // 09:15

// A record shaped for the UI (employee name resolved via the relation).
export type AttendanceRow = {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string; // "YYYY-MM-DD"
  clockIn: string | null; // ISO datetime
  clockOut: string | null; // ISO datetime
  status: string;
};

/*
  The business time zone. Servers (Vercel) run on UTC, but the workday is in
  Lagos — so "today", "late after 09:15" and every displayed time must be
  worked out in THIS zone, never the machine's. Using the same zone on the
  server and in the browser also makes both render identical text.
  (Later, for multiple customers, this becomes a per-company setting.)
*/
export const APP_TIME_ZONE = "Africa/Lagos";

// "en-CA" formats dates as YYYY-MM-DD, which is exactly the shape we store.
const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const clockFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const timeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
});

// Today's calendar day in the business time zone, as "YYYY-MM-DD".
export function todayISO(d: Date = new Date()): string {
  return dayFormat.format(d);
}

// Minutes since midnight (business time zone) for an ISO datetime.
export function minutesOfDay(iso: string): number {
  const parts = clockFormat.formatToParts(new Date(iso));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return (get("hour") % 24) * 60 + get("minute");
}

// Was this clock-in late (after the threshold)?
export function isLate(clockInIso: string): boolean {
  return minutesOfDay(clockInIso) > LATE_AFTER_MINUTES;
}

// Minutes worked between clock-in and clock-out (null if either is missing).
export function minutesWorked(clockIn: string | null, clockOut: string | null): number | null {
  if (!clockIn || !clockOut) return null;
  const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime();
  if (isNaN(ms) || ms < 0) return null;
  return Math.round(ms / 60000);
}

// "8h 12m" from a minute count (or "—" when unknown).
export function formatDuration(minutes: number | null): string {
  if (minutes === null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

// "9:03 AM" from an ISO datetime (or "—").
export function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return timeFormat.format(d); // always business time zone
}

// How many minutes after the 09:15 cut-off someone clocked in (0 if on time).
export function minutesLate(clockInIso: string): number {
  return Math.max(0, minutesOfDay(clockInIso) - LATE_AFTER_MINUTES);
}

// "9:15 AM" — the late threshold, for labels.
export const LATE_AFTER_LABEL = `${Math.floor(LATE_AFTER_MINUTES / 60)}:${String(LATE_AFTER_MINUTES % 60).padStart(2, "0")} AM`;

// "Mon, Jul 26" from a "YYYY-MM-DD" date.
export function formatDay(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  if (isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
