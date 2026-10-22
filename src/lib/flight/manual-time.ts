/** Wall-clock helpers for manual entry ("HH:MM" strings in the flight's local zone). */

const pad = (n: number) => String(n).padStart(2, "0");

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  const m = ((total % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** Landing time for a takeoff + duration; flags when it rolls past midnight. */
export function landingFor(takeoff: string, durationMin: number): { landing: string; nextDay: boolean } {
  const end = toMinutes(takeoff) + Math.max(0, Math.round(durationMin));
  return { landing: fromMinutes(end), nextDay: end >= 1440 };
}

/** Duration in minutes between two wall-clock times (assumes < 24 h, crossing midnight allowed). */
export function minutesBetween(takeoff: string, landing: string): number {
  const d = toMinutes(landing) - toMinutes(takeoff);
  return d > 0 ? d : d + 1440;
}

/** Local date/time parts of an instant in a zone: { date: "2026-10-22", time: "14:05" }. */
export function localParts(epochMs: number, timeZone: string): { date: string; time: string } {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(epochMs)
      .map((x) => [x.type, x.value]),
  );
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/** "Just landed": landing = now, takeoff = now − duration, dated by the takeoff. */
export function justLanded(nowMs: number, durationMin: number, timeZone: string) {
  const takeoff = localParts(nowMs - durationMin * 60_000, timeZone);
  const landing = localParts(nowMs, timeZone);
  return { date: takeoff.date, takeoffTime: takeoff.time, landingTime: landing.time };
}
