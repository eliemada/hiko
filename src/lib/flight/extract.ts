import { haversineMeters, isValidCoord } from "./geo";
import type { FlightSegment, FlightWarning, FrameLike, TrackPoint } from "./types";

/** Airborne runs separated by less than this are one flight (a bounce, a hand-catch retry…). */
export const MERGE_GAP_MS = 20_000;
/** Shorter airborne runs are motor tests or log glitches, not flights. */
export const MIN_FLIGHT_MS = 5_000;
/** Track resolution kept for maps and charts. */
export const TRACK_INTERVAL_MS = 1_000;
/** Warnings this long before takeoff / after landing still belong to the flight. */
const WARNING_MARGIN_MS = 60_000;
/** GPS jumps faster than this between two frames are ignored when summing distance. */
const MAX_PLAUSIBLE_SPEED_MS = 60;

interface Sample {
  t: number;
  airborne: boolean;
  frame: FrameLike;
}

const MIN_VALID_EPOCH = Date.UTC(2015, 0, 1);

export function parseFrameTime(dateTime: string): number | null {
  const t = Date.parse(dateTime);
  return Number.isFinite(t) && t >= MIN_VALID_EPOCH ? t : null;
}

function toSamples(frames: readonly FrameLike[]): Sample[] {
  return frames.flatMap((frame) => {
    const t = parseFrameTime(frame.custom.dateTime);
    if (t === null) return [];
    return [{ t, airborne: frame.osd.isMotorOn && !frame.osd.isOnGround, frame }];
  });
}

interface Run {
  start: number; // index of first airborne sample
  end: number; // index of last airborne sample
}

export function findAirborneRuns(samples: readonly { t: number; airborne: boolean }[]): Run[] {
  const raw: Run[] = [];
  let start = -1;
  samples.forEach((s, i) => {
    if (s.airborne && start === -1) start = i;
    if (!s.airborne && start !== -1) {
      raw.push({ start, end: i - 1 });
      start = -1;
    }
  });
  if (start !== -1) raw.push({ start, end: samples.length - 1 });

  const merged = raw.reduce<Run[]>((acc, run) => {
    const prev = acc.at(-1);
    if (prev && samples[run.start].t - samples[prev.end].t < MERGE_GAP_MS) {
      return [...acc.slice(0, -1), { start: prev.start, end: run.end }];
    }
    return [...acc, run];
  }, []);

  return merged.filter((run) => samples[run.end].t - samples[run.start].t >= MIN_FLIGHT_MS);
}

function coordOf(frame: FrameLike) {
  const { latitude: lat, longitude: lng } = frame.osd;
  return isValidCoord(lat, lng) ? { lat, lng } : null;
}

function homeOf(frame: FrameLike) {
  const { latitude: lat, longitude: lng } = frame.home;
  return isValidCoord(lat, lng) ? { lat, lng } : null;
}

function firstCoord(samples: readonly Sample[]) {
  for (const s of samples) {
    const c = coordOf(s.frame) ?? homeOf(s.frame);
    if (c) return c;
  }
  return null;
}

function collectWarnings(samples: readonly Sample[], from: number, to: number): FlightWarning[] {
  const seen = new Set<string>();
  return samples
    .filter((s) => s.t >= from - WARNING_MARGIN_MS && s.t <= to + WARNING_MARGIN_MS)
    .flatMap((s) => {
      const message = s.frame.app.warn?.trim();
      if (!message || seen.has(message)) return [];
      seen.add(message);
      return [{ at: s.t, message }];
    });
}

function downsampleTrack(samples: readonly Sample[]): TrackPoint[] {
  const track: TrackPoint[] = [];
  for (const s of samples) {
    const c = coordOf(s.frame);
    if (!c) continue;
    const last = track.at(-1);
    if (last && s.t - last[3] < TRACK_INTERVAL_MS) continue;
    track.push([round(c.lng, 7), round(c.lat, 7), round(s.frame.osd.height, 1), s.t]);
  }
  return track;
}

/** Max without spreading (a 3 h log has >100k frames — too many call arguments). */
const maxOf = (samples: readonly Sample[], fn: (s: Sample) => number) =>
  samples.reduce((m, s) => Math.max(m, fn(s)), 0);

function pathLength(samples: readonly Sample[]): number {
  let total = 0;
  let prev: { lat: number; lng: number; t: number } | null = null;
  for (const s of samples) {
    const c = coordOf(s.frame);
    if (!c) continue;
    if (prev) {
      const d = haversineMeters(prev, c);
      const dt = Math.max((s.t - prev.t) / 1000, 0.05);
      if (d / dt <= MAX_PLAUSIBLE_SPEED_MS) total += d;
    }
    prev = { ...c, t: s.t };
  }
  return total;
}

const round = (n: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
};

function batteryLevel(sample: Sample | undefined): number | null {
  const level = sample?.frame.battery.chargeLevel;
  return typeof level === "number" && level > 0 && level <= 100 ? level : null;
}

function buildSegment(samples: readonly Sample[], run: Run): FlightSegment | null {
  const inAir = samples.slice(run.start, run.end + 1);
  const takeoffAt = samples[run.start].t;
  // Landing = first grounded sample after the run, so the duration includes the touchdown.
  const landingAt = samples[run.end + 1]?.t ?? samples[run.end].t;

  const takeoff = firstCoord(samples.slice(Math.max(0, run.start - 5), run.end + 1));
  const landing = firstCoord([...inAir].reverse());
  if (!takeoff || !landing) return null;

  const maxDistance = inAir.reduce((max, s) => {
    const c = coordOf(s.frame);
    return c ? Math.max(max, haversineMeters(takeoff, c)) : max;
  }, 0);

  return {
    takeoffAt,
    landingAt,
    durationSec: Math.round((landingAt - takeoffAt) / 1000),
    takeoff,
    landing,
    maxHeight: round(maxOf(inAir, (s) => s.frame.osd.height), 1),
    maxDistance: Math.round(maxDistance),
    maxSpeed: round(maxOf(inAir, (s) => Math.hypot(s.frame.osd.xSpeed, s.frame.osd.ySpeed)), 1),
    totalDistance: Math.round(pathLength(inAir)),
    batteryStart: batteryLevel(samples[run.start]),
    batteryEnd: batteryLevel(samples[run.end]),
    warnings: collectWarnings(samples, takeoffAt, landingAt),
    track: downsampleTrack(inAir),
  };
}

/**
 * Split a decoded DJI log into flights. One power cycle can contain several
 * takeoffs (land, swap nothing, take off again); MLIT wants one row per flight.
 * Times are real takeoff/landing (airborne), not power on/off — as required by ⑦⑧.
 */
export function extractFlights(frames: readonly FrameLike[]): FlightSegment[] {
  const samples = toSamples(frames);
  return findAirborneRuns(samples)
    .map((run) => buildSegment(samples, run))
    .filter((s): s is FlightSegment => s !== null);
}

export const ESTIMATED_TIMES_WARNING =
  "Times estimated from the log header (encrypted log, DJI API key not configured) — please verify ⑦⑧.";

/**
 * Fallback for encrypted logs when no DJI API key is set: the unencrypted
 * header still gives start time, flight time, home point and maxima.
 */
export function segmentFromHeader(header: {
  startTime: number | null;
  totalTimeSec: number;
  latitude: number;
  longitude: number;
  maxHeight: number;
  totalDistance: number;
  maxHorizontalSpeed: number;
}): FlightSegment | null {
  if (header.startTime === null || header.totalTimeSec <= 0) return null;
  if (!isValidCoord(header.latitude, header.longitude)) return null;
  const point = { lat: header.latitude, lng: header.longitude };
  const durationSec = Math.round(header.totalTimeSec);
  return {
    takeoffAt: header.startTime,
    landingAt: header.startTime + durationSec * 1000,
    durationSec,
    takeoff: point,
    landing: point,
    maxHeight: round(header.maxHeight, 1),
    maxDistance: 0,
    maxSpeed: round(header.maxHorizontalSpeed, 1),
    totalDistance: Math.round(header.totalDistance),
    batteryStart: null,
    batteryEnd: null,
    warnings: [{ at: header.startTime, message: ESTIMATED_TIMES_WARNING }],
    track: [],
  };
}
