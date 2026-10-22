import { describe, expect, it } from "vitest";
import { paginateJournal, withRunningTotals } from "./journal";

describe("withRunningTotals", () => {
  it("accumulates per aircraft in chronological order from the initial hours", () => {
    const flights = [
      { id: "c", aircraftId: "A", takeoffAt: 300, durationSec: 30 },
      { id: "a", aircraftId: "A", takeoffAt: 100, durationSec: 10 },
      { id: "b", aircraftId: "B", takeoffAt: 200, durationSec: 20 },
    ];
    const result = withRunningTotals(flights, { A: 1000 });
    expect(result.map((f) => [f.id, f.totalSec])).toEqual([
      ["a", 1010],
      ["b", 20],
      ["c", 1040],
    ]);
    expect(flights[0]).not.toHaveProperty("totalSec");
  });
});

describe("paginateJournal", () => {
  it("always returns at least one empty sheet", () => {
    expect(paginateJournal([], [])).toEqual([{ number: 1, flights: [], squawks: [] }]);
  });

  it("splits into 15 flights and 5 reports per sheet", () => {
    const flights = Array.from({ length: 31 }, (_, i) => i);
    const squawks = Array.from({ length: 6 }, (_, i) => `s${i}`);
    const pages = paginateJournal(flights, squawks);
    expect(pages).toHaveLength(3);
    expect(pages[0].flights).toHaveLength(15);
    expect(pages[2].flights).toEqual([30]);
    expect(pages[0].squawks).toHaveLength(5);
    expect(pages[1].squawks).toEqual(["s5"]);
    expect(pages[2].squawks).toEqual([]);
  });
});
