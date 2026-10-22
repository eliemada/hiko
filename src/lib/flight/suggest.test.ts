import { describe, expect, it } from "vitest";
import { defaultSafetyNotes, natureOfFlight, suggestSpecificFlights } from "./suggest";
import type { FlightSegment } from "./types";

const base: FlightSegment = {
  takeoffAt: Date.UTC(2026, 5, 21, 3, 0), // noon JST
  landingAt: Date.UTC(2026, 5, 21, 3, 15),
  durationSec: 900,
  takeoff: { lat: 35.68, lng: 139.77 },
  landing: { lat: 35.68, lng: 139.77 },
  maxHeight: 80,
  maxDistance: 300,
  maxSpeed: 10,
  totalDistance: 1200,
  batteryStart: 100,
  batteryEnd: 30,
  warnings: [],
  track: [],
};

describe("suggestSpecificFlights", () => {
  it("suggests nothing for a daytime flight below 150 m", () => {
    expect(suggestSpecificFlights(base)).toEqual([]);
  });

  it("flags flights at or above 150 m", () => {
    expect(suggestSpecificFlights({ ...base, maxHeight: 150 })).toEqual(["above150m"]);
  });

  it("flags flights that end after sunset", () => {
    expect(
      suggestSpecificFlights({ ...base, landingAt: Date.UTC(2026, 5, 21, 11, 0) /* 20:00 JST */ }),
    ).toEqual(["night"]);
  });
});

describe("natureOfFlight", () => {
  it("combines purpose, specific flights and route", () => {
    expect(natureOfFlight("空撮", ["night", "bvlos"], "多摩川河川敷")).toBe(
      "空撮 [特定飛行: 夜間飛行・目視外飛行] 経由地: 多摩川河川敷",
    );
    expect(natureOfFlight("訓練", [], " ")).toBe("訓練");
  });
});

describe("defaultSafetyNotes", () => {
  it("lists weather and warnings", () => {
    expect(defaultSafetyNotes("晴れ", [{ message: "Strong wind" }, { message: "Low battery" }])).toBe(
      "天候 Weather: 晴れ\n機体警告 Warnings: Strong wind / Low battery",
    );
  });

  it("says 特になし None when nothing happened", () => {
    expect(defaultSafetyNotes("", [])).toBe("特になし None");
  });
});
