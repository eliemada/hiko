/**
 * Convert a wall-clock time in an IANA zone to epoch ms
 * (e.g. "2026-10-21" + "14:05" in Asia/Tokyo → 2026-10-21T05:05Z).
 */
export function zonedTimeToEpoch(date: string, time: string, timeZone: string): number {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  const asUtc = Date.UTC(y, mo - 1, d, h, mi);
  // Offset of the zone at that instant; one correction pass handles DST edges.
  const offset = (t: number) => {
    const p = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
        .formatToParts(t)
        .map((x) => [x.type, Number(x.value)]),
    );
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - t;
  };
  const guess = asUtc - offset(asUtc);
  return asUtc - offset(guess);
}
