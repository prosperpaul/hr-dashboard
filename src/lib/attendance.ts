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

// The LOCAL calendar day as "YYYY-MM-DD" (not UTC, so "today" matches the user).
export function todayISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Minutes since midnight (local) for an ISO datetime.
function minutesOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
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
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

// "Mon, Jul 26" from a "YYYY-MM-DD" date.
export function formatDay(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  if (isNaN(d.getTime())) return dateISO;
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
