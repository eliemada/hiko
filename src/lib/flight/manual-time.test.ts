import { describe, expect, it } from "vitest";
import { fromMinutes, justLanded, landingFor, localParts, minutesBetween, toMinutes } from "./manual-time";

describe("manual-time", () => {
  it("converts between HH:MM and minutes", () => {
    expect(toMinutes("14:05")).toBe(845);
    expect(fromMinutes(845)).toBe("14:05");
    expect(fromMinutes(1445)).toBe("00:05");
  });

  it("computes landing from duration, across midnight", () => {
    expect(landingFor("14:12", 20)).toEqual({ landing: "14:32", nextDay: false });
    expect(landingFor("23:50", 25)).toEqual({ landing: "00:15", nextDay: true });
  });

  it("measures duration, across midnight", () => {
    expect(minutesBetween("14:12", "14:32")).toBe(20);
    expect(minutesBetween("23:50", "00:15")).toBe(25);
  });

  it("formats local parts in a zone", () => {
    expect(localParts(Date.UTC(2026, 9, 21, 16, 30), "Asia/Tokyo")).toEqual({ date: "2026-10-22", time: "01:30" });
  });

  it("back-dates takeoff for 'just landed', even across midnight", () => {
    const now = Date.UTC(2026, 9, 21, 15, 10); // 00:10 JST on the 22nd
    expect(justLanded(now, 20, "Asia/Tokyo")).toEqual({ date: "2026-10-21", takeoffTime: "23:50", landingTime: "00:10" });
  });
});
