/** 754 s → "0:12" (MLIT logs use h:mm; seconds are rounded to the nearest minute). */
export function formatHoursMinutes(totalSeconds: number): string {
  const minutes = Math.round(Math.max(0, totalSeconds) / 60);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/** 754 s → "12m 34s", for UI where precision matters. */
export function formatDurationLong(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  return `${m}m ${String(sec).padStart(2, "0")}s`;
}

function parts(epochMs: number, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return Object.fromEntries(fmt.formatToParts(epochMs).map((p) => [p.type, p.value]));
}

/** "2026/10/21" in the flight's local time zone. */
export function formatLogDate(epochMs: number, timeZone: string): string {
  const p = parts(epochMs, timeZone);
  return `${p.year}/${p.month}/${p.day}`;
}

/** "14:05" in the flight's local time zone. */
export function formatLogTime(epochMs: number, timeZone: string): string {
  const p = parts(epochMs, timeZone);
  return `${p.hour}:${p.minute}`;
}

/** "2026-10-21" — handy for <input type="date"> and grouping. */
export function isoDate(epochMs: number, timeZone: string): string {
  const p = parts(epochMs, timeZone);
  return `${p.year}-${p.month}-${p.day}`;
}

export function formatMeters(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}
