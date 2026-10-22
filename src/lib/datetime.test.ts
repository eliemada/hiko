import { describe, expect, it } from "vitest";
import { zonedTimeToEpoch } from "./datetime";

describe("zonedTimeToEpoch", () => {
  it("converts Tokyo wall time", () => {
    expect(zonedTimeToEpoch("2026-10-21", "14:05", "Asia/Tokyo")).toBe(Date.UTC(2026, 9, 21, 5, 5));
  });

  it("handles DST zones", () => {
    expect(zonedTimeToEpoch("2026-07-01", "12:00", "Europe/London")).toBe(Date.UTC(2026, 6, 1, 11, 0));
    expect(zonedTimeToEpoch("2026-01-01", "12:00", "Europe/London")).toBe(Date.UTC(2026, 0, 1, 12, 0));
  });
});
