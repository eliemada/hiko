import { describe, expect, it } from "vitest";
import {
  formatDurationLong,
  formatHoursMinutes,
  formatLogDate,
  formatLogTime,
  formatMeters,
  isoDate,
} from "./format";
import { haversineMeters, isNight, isValidCoord, sunElevationDeg } from "./geo";

describe("format", () => {
  it("formats h:mm with rounding", () => {
    expect(formatHoursMinutes(0)).toBe("0:00");
    expect(formatHoursMinutes(754)).toBe("0:13");
    expect(formatHoursMinutes(3600 * 12 + 60 * 5)).toBe("12:05");
    expect(formatHoursMinutes(-5)).toBe("0:00");
  });

  it("formats long durations", () => {
    expect(formatDurationLong(754)).toBe("12m 34s");
    expect(formatDurationLong(3700)).toBe("1h 01m");
  });

  it("formats in the flight's time zone", () => {
    const t = Date.UTC(2026, 9, 21, 16, 30); // 01:30 next day in Tokyo
    expect(formatLogDate(t, "Asia/Tokyo")).toBe("2026/10/22");
    expect(formatLogTime(t, "Asia/Tokyo")).toBe("01:30");
    expect(isoDate(t, "UTC")).toBe("2026-10-21");
    expect(formatLogTime(Date.UTC(2026, 0, 1, 0, 5), "UTC")).toBe("00:05");
  });

  it("formats meters", () => {
    expect(formatMeters(523.4)).toBe("523 m");
    expect(formatMeters(1530)).toBe("1.53 km");
  });
});

describe("geo", () => {
  it("measures Tokyo → Osaka at ~400 km", () => {
    const d = haversineMeters({ lat: 35.6812, lng: 139.7671 }, { lat: 34.7025, lng: 135.4959 });
    expect(d).toBeGreaterThan(395_000);
    expect(d).toBeLessThan(405_000);
  });

  it("validates coordinates", () => {
    expect(isValidCoord(35, 139)).toBe(true);
    expect(isValidCoord(0, 0)).toBe(false);
    expect(isValidCoord(91, 0)).toBe(false);
    expect(isValidCoord(Number.NaN, 0)).toBe(false);
  });

  it("knows day from night in Tokyo", () => {
    const noonJst = Date.UTC(2026, 5, 21, 3, 0);
    const midnightJst = Date.UTC(2026, 5, 21, 15, 0);
    expect(sunElevationDeg(noonJst, 35.68, 139.77)).toBeGreaterThan(70);
    expect(isNight(noonJst, 35.68, 139.77)).toBe(false);
    expect(isNight(midnightJst, 35.68, 139.77)).toBe(true);
  });

  it("puts Tokyo sunset on 2026-10-21 around 17:00 JST", () => {
    const before = Date.UTC(2026, 9, 21, 7, 50); // 16:50 JST
    const after = Date.UTC(2026, 9, 21, 8, 15); // 17:15 JST
    expect(isNight(before, 35.68, 139.77)).toBe(false);
    expect(isNight(after, 35.68, 139.77)).toBe(true);
  });
});
