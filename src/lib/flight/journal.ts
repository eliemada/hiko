/** Rows per printed sheet in the official MLIT template. */
export const FLIGHT_ROWS_PER_PAGE = 15;
export const SQUAWK_ROWS_PER_PAGE = 5;

export interface Timed {
  aircraftId: string;
  takeoffAt: number;
  durationSec: number;
}

/**
 * ⑩ 総飛行時間 — cumulative airframe time *after* each flight,
 * starting from the hours flown before the app was used.
 */
export function withRunningTotals<T extends Timed>(
  flights: readonly T[],
  initialSecondsByAircraft: Readonly<Record<string, number>>,
): (T & { totalSec: number })[] {
  const ordered = [...flights].sort((a, b) => a.takeoffAt - b.takeoffAt);
  const running = new Map<string, number>();
  return ordered.map((f) => {
    const total = (running.get(f.aircraftId) ?? initialSecondsByAircraft[f.aircraftId] ?? 0) + f.durationSec;
    running.set(f.aircraftId, total);
    return { ...f, totalSec: total };
  });
}

const chunk = <T>(items: readonly T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size));

export interface JournalPage<F, S> {
  number: number;
  flights: F[];
  squawks: S[];
}

/** Split one aircraft's log into official 15-flight / 5-report sheets. */
export function paginateJournal<F, S>(flights: readonly F[], squawks: readonly S[]): JournalPage<F, S>[] {
  const flightPages = chunk(flights, FLIGHT_ROWS_PER_PAGE);
  const squawkPages = chunk(squawks, SQUAWK_ROWS_PER_PAGE);
  const count = Math.max(1, flightPages.length, squawkPages.length);
  return Array.from({ length: count }, (_, i) => ({
    number: i + 1,
    flights: flightPages[i] ?? [],
    squawks: squawkPages[i] ?? [],
  }));
}
