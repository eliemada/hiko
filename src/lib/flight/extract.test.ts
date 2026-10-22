import { describe, expect, it } from "vitest";
import {
  ESTIMATED_TIMES_WARNING,
  extractFlights,
  findAirborneRuns,
  parseFrameTime,
  segmentFromHeader,
} from "./extract";
import type { FrameLike } from "./types";

const T0 = Date.UTC(2026, 9, 21, 5, 0, 0); // 14:00 JST

interface FrameOpts {
  airborne?: boolean;
  lat?: number;
  lng?: number;
  height?: number;
  speed?: number;
  warn?: string;
  battery?: number;
  dateTime?: string;
}

function frame(t: number, o: FrameOpts = {}): FrameLike {
  return {
    custom: { dateTime: o.dateTime ?? new Date(t).toISOString() },
    osd: {
      flyTime: 0,
      latitude: o.lat ?? 35.681,
      longitude: o.lng ?? 139.767,
      height: o.height ?? 0,
      altitude: 40,
      xSpeed: o.speed ?? 0,
      ySpeed: 0,
      zSpeed: 0,
      isOnGround: !o.airborne,
      isMotorOn: !!o.airborne,
    },
    home: { latitude: 35.681, longitude: 139.767 },
    battery: { chargeLevel: o.battery ?? 90 },
    app: { warn: o.warn ?? "", tip: "" },
  };
}

/** 10 Hz frames: `groundS` on the ground, `airS` airborne heading north, then `groundS` again. */
function simpleFlight(start: number, groundS: number, airS: number): FrameLike[] {
  const frames: FrameLike[] = [];
  const total = (groundS * 2 + airS) * 10;
  for (let i = 0; i < total; i++) {
    const t = start + i * 100;
    const airborne = i >= groundS * 10 && i < (groundS + airS) * 10;
    const k = airborne ? i - groundS * 10 : 0;
    frames.push(
      frame(t, {
        airborne,
        lat: 35.681 + (airborne ? k * 0.00001 : 0),
        height: airborne ? Math.min(k / 10, 50) : 0,
        speed: airborne ? 5 : 0,
        battery: 90 - Math.floor(i / 100),
      }),
    );
  }
  return frames;
}

describe("parseFrameTime", () => {
  it("parses ISO timestamps", () => {
    expect(parseFrameTime("2026-10-21T05:00:00.000Z")).toBe(T0);
  });
  it("rejects garbage and pre-GPS epoch placeholders", () => {
    expect(parseFrameTime("not a date")).toBeNull();
    expect(parseFrameTime("1970-01-01T00:00:00Z")).toBeNull();
  });
});

describe("findAirborneRuns", () => {
  const s = (t: number, airborne: boolean) => ({ t, airborne });

  it("merges runs separated by a short touch-and-go", () => {
    const samples = [s(0, false), s(1_000, true), s(10_000, true), s(15_000, false), s(20_000, true), s(40_000, true)];
    expect(findAirborneRuns(samples)).toEqual([{ start: 1, end: 5 }]);
  });

  it("keeps runs apart when the aircraft rested on the ground long enough", () => {
    const samples = [s(0, true), s(10_000, true), s(11_000, false), s(60_000, false), s(61_000, true), s(80_000, true)];
    expect(findAirborneRuns(samples)).toEqual([
      { start: 0, end: 1 },
      { start: 4, end: 5 },
    ]);
  });

  it("drops motor tests shorter than the minimum flight", () => {
    expect(findAirborneRuns([s(0, true), s(2_000, true), s(3_000, false)])).toEqual([]);
  });
});

describe("extractFlights", () => {
  it("uses airborne time, not power-on time, for takeoff and landing", () => {
    const [flight] = extractFlights(simpleFlight(T0, 30, 120));
    expect(flight.takeoffAt).toBe(T0 + 30_000);
    expect(flight.landingAt).toBe(T0 + 150_000);
    expect(flight.durationSec).toBe(120);
  });

  it("computes summary metrics", () => {
    const [flight] = extractFlights(simpleFlight(T0, 5, 100));
    expect(flight.maxHeight).toBe(50);
    expect(flight.maxSpeed).toBe(5);
    // 1000 steps of 0.00001° latitude ≈ 1.11 km
    expect(flight.maxDistance).toBeGreaterThan(1_050);
    expect(flight.maxDistance).toBeLessThan(1_150);
    expect(flight.totalDistance).toBeGreaterThan(1_050);
    expect(flight.takeoff.lat).toBeCloseTo(35.681, 5);
    expect(flight.landing.lat).toBeGreaterThan(35.69);
    expect(flight.batteryStart).toBeGreaterThan(flight.batteryEnd ?? 100);
  });

  it("downsamples the track to about one point per second", () => {
    const [flight] = extractFlights(simpleFlight(T0, 5, 100));
    expect(flight.track.length).toBeGreaterThanOrEqual(99);
    expect(flight.track.length).toBeLessThanOrEqual(101);
    const [lng, lat, h, t] = flight.track[10];
    expect(lng).toBeCloseTo(139.767, 5);
    expect(lat).toBeGreaterThan(35.681);
    expect(h).toBeGreaterThan(0);
    expect(t).toBe(flight.takeoffAt + 10_000);
  });

  it("splits one log into two flights after a long ground stop", () => {
    const first = simpleFlight(T0, 5, 60);
    const second = simpleFlight(T0 + first.length * 100 + 120_000, 5, 30);
    const flights = extractFlights([...first, ...second]);
    expect(flights).toHaveLength(2);
    expect(flights[1].durationSec).toBe(30);
  });

  it("collects each distinct warning once", () => {
    const frames = simpleFlight(T0, 5, 30).map((f, i) =>
      i > 100 && i < 200 ? { ...f, app: { warn: "Strong wind. Fly with caution", tip: "" } } : f,
    );
    const [flight] = extractFlights(frames);
    expect(flight.warnings).toHaveLength(1);
    expect(flight.warnings[0].message).toMatch(/Strong wind/);
  });

  it("ignores frames without valid time or GPS", () => {
    const frames = [
      frame(T0, { dateTime: "1970-01-01T00:00:00Z", airborne: true }),
      ...simpleFlight(T0, 5, 30).map((f, i) =>
        i % 7 === 0 ? { ...f, osd: { ...f.osd, latitude: 0, longitude: 0 } } : f,
      ),
    ];
    const [flight] = extractFlights(frames);
    expect(flight.durationSec).toBe(30);
    expect(flight.track.every(([lng, lat]) => lat > 30 && lng > 130)).toBe(true);
  });

  it("returns nothing for a log where the drone never flew", () => {
    expect(extractFlights(Array.from({ length: 50 }, (_, i) => frame(T0 + i * 100)))).toEqual([]);
  });
});

describe("segmentFromHeader", () => {
  const header = {
    startTime: T0,
    totalTimeSec: 1184.6,
    latitude: 35.68,
    longitude: 139.77,
    maxHeight: 61.23,
    totalDistance: 2345.6,
    maxHorizontalSpeed: 12.34,
  };

  it("builds an estimated flight from the unencrypted header", () => {
    const seg = segmentFromHeader(header);
    expect(seg?.durationSec).toBe(1185);
    expect(seg?.landingAt).toBe(T0 + 1_185_000);
    expect(seg?.maxHeight).toBe(61.2);
    expect(seg?.warnings[0].message).toBe(ESTIMATED_TIMES_WARNING);
  });

  it("rejects headers without time, duration or position", () => {
    expect(segmentFromHeader({ ...header, startTime: null })).toBeNull();
    expect(segmentFromHeader({ ...header, totalTimeSec: 0 })).toBeNull();
    expect(segmentFromHeader({ ...header, latitude: 0, longitude: 0 })).toBeNull();
  });
});

describe("long flights", () => {
  it("handles a 4-hour, 10 Hz log without overflowing the call stack", () => {
    const frames = simpleFlight(T0, 2, 4 * 3600);
    expect(frames.length).toBeGreaterThan(140_000);
    const [flight] = extractFlights(frames);
    expect(flight.durationSec).toBe(4 * 3600);
    expect(flight.maxHeight).toBe(50);
  });
});
