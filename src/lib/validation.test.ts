import { describe, expect, it } from "vitest";
import { manualFlightSchema } from "./validation";

const base = {
  purpose: "訓練",
  specificFlights: [],
  route: "",
  takeoffPlace: "東京都",
  landingPlace: "東京都",
  safetyNotes: "",
  remarks: "",
  aircraftId: "a",
  pilotId: "p",
  date: "2026-10-21",
  takeoffTime: "09:05",
  landingTime: "09:30",
  timeZone: "Asia/Tokyo",
};

describe("manualFlightSchema", () => {
  it("accepts a valid entry", () => {
    expect(manualFlightSchema.safeParse(base).success).toBe(true);
  });

  it.each([
    ["date", "2026-02-31"],
    ["date", "2026-13-01"],
    ["takeoffTime", "24:00"],
    ["landingTime", "09:60"],
  ])("rejects %s = %s", (field, value) => {
    expect(manualFlightSchema.safeParse({ ...base, [field]: value }).success).toBe(false);
  });

  it("rejects unknown 特定飛行 kinds", () => {
    expect(manualFlightSchema.safeParse({ ...base, specificFlights: ["teleport"] }).success).toBe(false);
  });
});
