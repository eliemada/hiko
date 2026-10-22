import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import tzlookup from "@photostructure/tz-lookup";
import { eq, like } from "drizzle-orm";
import type { KeychainFeaturePoint } from "dji-log-parser-js";
import { db } from "../db";
import { aircraft, flight, logFile, type NewFlight } from "../db/schema";
import { decodeDjiLog } from "../dji/decode";
import { reverseGeocode } from "../enrich/geocode";
import { fetchWeather, weatherSummary } from "../enrich/weather";
import { ESTIMATED_TIMES_WARNING, extractFlights, segmentFromHeader } from "../flight/extract";
import { haversineMeters } from "../flight/geo";
import { defaultSafetyNotes, suggestSpecificFlights } from "../flight/suggest";
import type { FlightSegment } from "../flight/types";

export const MAX_LOG_BYTES = 40 * 1024 * 1024;
/** Landing this close to takeoff reuses the takeoff address (saves a geocoding call). */
const SAME_PLACE_M = 50;

const dataDir = () => process.env.DATA_DIR ?? path.join(process.cwd(), "data");

export interface ImportedFlight {
  id: string;
  takeoffAt: number;
  durationSec: number;
  takeoffPlace: string;
  timeZone: string;
}

export type IngestResult =
  | { status: "imported"; aircraftName: string; estimated: boolean; flights: ImportedFlight[] }
  | { status: "duplicate"; flights: ImportedFlight[] }
  | { status: "empty"; message: string };

function safeTimeZone(lat: number, lng: number): string {
  try {
    return tzlookup(lat, lng);
  } catch {
    return "UTC";
  }
}

/** "Mavic 4 Pro" ≈ "DJI Mavic 4 Pro": compare without the brand and punctuation. */
export function sameModel(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\bdji\b/g, "").replace(/[^a-z0-9]+/g, "");
  const [x, y] = [norm(a), norm(b)];
  return x.length > 0 && x === y;
}

async function findOrCreateAircraft(serial: string, name: string) {
  const label = name || "DJI aircraft";
  if (!serial) {
    // No serial in the log: reuse an aircraft of the same model rather than spawning duplicates.
    const sameModel = await db.query.aircraft.findFirst({
      where: (a, { and, eq, or }) => and(eq(a.archived, false), or(eq(a.model, label), eq(a.name, label))),
    });
    if (sameModel) return sameModel;
    const [created] = await db.insert(aircraft).values({ name: label, model: name }).returning();
    return created;
  }
  // An aircraft first seen through a header-only import has the 16-character
  // truncated serial: upgrade it once the full serial is known.
  if (serial.length > 16) {
    await db
      .update(aircraft)
      .set({ serialNumber: serial })
      .where(eq(aircraft.serialNumber, serial.slice(0, 16)))
      .catch(() => undefined); // full serial already exists → keep both, the lookup below wins
  }
  // An aircraft the pilot added by hand (no serial yet) of the same model claims
  // this serial instead of a duplicate aircraft being created.
  const existing = await db.query.aircraft.findFirst({ where: eq(aircraft.serialNumber, serial) });
  if (existing) return existing;
  const unclaimed = (await db.query.aircraft.findMany({ where: (a, { and, eq }) => and(eq(a.archived, false), eq(a.serialNumber, "")) }))
    .filter((a) => sameModel(a.model || a.name, label));
  if (unclaimed.length === 1) {
    const [claimed] = await db.update(aircraft).set({ serialNumber: serial }).where(eq(aircraft.id, unclaimed[0].id)).returning();
    if (claimed) return claimed;
  }
  // Insert-or-ignore on the unique serial index, then read: safe under parallel imports.
  await db.insert(aircraft).values({ name: label, model: name, serialNumber: serial }).onConflictDoNothing();
  const row = await db.query.aircraft.findFirst({ where: eq(aircraft.serialNumber, serial) });
  if (!row) throw new Error(`Aircraft ${serial} vanished after insert`);
  return row;
}

async function existingFlights(sha: string): Promise<ImportedFlight[]> {
  return db
    .select({
      id: flight.id,
      takeoffAt: flight.takeoffAt,
      durationSec: flight.durationSec,
      takeoffPlace: flight.takeoffPlace,
      timeZone: flight.timeZone,
    })
    .from(flight)
    .where(like(flight.sourceKey, `${sha}:%`));
}

async function buildFlightRow(
  seg: FlightSegment,
  index: number,
  ctx: { sha: string; fileName: string; aircraftId: string; pilotId: string; batterySerial: string },
): Promise<NewFlight> {
  const timeZone = safeTimeZone(seg.takeoff.lat, seg.takeoff.lng);
  const takeoffPlace = await reverseGeocode(seg.takeoff.lat, seg.takeoff.lng);
  const landingPlace =
    haversineMeters(seg.takeoff, seg.landing) < SAME_PLACE_M
      ? takeoffPlace
      : await reverseGeocode(seg.landing.lat, seg.landing.lng);
  const weather = await fetchWeather(seg.takeoff.lat, seg.takeoff.lng, seg.takeoffAt);

  return {
    aircraftId: ctx.aircraftId,
    pilotId: ctx.pilotId,
    source: "dji_log",
    sourceKey: `${ctx.sha}:${index}`,
    logFileName: ctx.fileName,
    takeoffAt: seg.takeoffAt,
    landingAt: seg.landingAt,
    durationSec: seg.durationSec,
    timeZone,
    takeoffLat: seg.takeoff.lat,
    takeoffLng: seg.takeoff.lng,
    landingLat: seg.landing.lat,
    landingLng: seg.landing.lng,
    takeoffPlace,
    landingPlace,
    specificFlights: suggestSpecificFlights(seg),
    safetyNotes: defaultSafetyNotes(
      weatherSummary(weather),
      seg.warnings.filter((w) => w.message !== ESTIMATED_TIMES_WARNING),
    ),
    maxHeight: seg.maxHeight,
    maxDistance: seg.maxDistance,
    maxSpeed: seg.maxSpeed,
    totalDistance: seg.totalDistance,
    batteryStart: seg.batteryStart,
    batteryEnd: seg.batteryEnd,
    batterySerial: ctx.batterySerial || null,
    warnings: seg.warnings,
    weather,
    track: [...seg.track],
  };
}

/**
 * Import one DJI Fly flight record: decode → split into flights → enrich
 * (address, weather, time zone, 特定飛行 hints) → store. Idempotent per file.
 */
export async function ingestLog(input: {
  bytes: Uint8Array;
  fileName: string;
  pilotId: string;
}): Promise<IngestResult> {
  const sha = createHash("sha256").update(input.bytes).digest("hex");

  const duplicates = await existingFlights(sha);
  if (duplicates.length > 0) return { status: "duplicate", flights: duplicates };

  const known = await db.query.logFile.findFirst({ where: eq(logFile.sha256, sha) });
  const decoded = await decodeDjiLog(
    input.bytes,
    (known?.keychains as KeychainFeaturePoint[][] | null | undefined) ?? null,
  );

  const estimated = decoded.frames === null;
  const segments = decoded.frames
    ? extractFlights(decoded.frames)
    : [segmentFromHeader(decoded.header)].filter((s): s is FlightSegment => s !== null);
  if (segments.length === 0) {
    return {
      status: "empty",
      message: estimated
        ? "Log header has no position — set DJI_API_KEY so the full encrypted log can be decoded."
        : "No takeoff found in this log (motors never left the ground).",
    };
  }

  const plane = await findOrCreateAircraft(decoded.aircraftSerial, decoded.aircraftName);
  const rows: NewFlight[] = [];
  for (const [i, seg] of segments.entries()) {
    rows.push(
      await buildFlightRow(seg, i, {
        sha,
        fileName: input.fileName,
        aircraftId: plane.id,
        pilotId: input.pilotId,
        batterySerial: decoded.batterySerial,
      }),
    );
  }

  const inserted = await db.transaction(async (tx) => {
    if (known) {
      if (decoded.keychains && !known.keychains) {
        await tx.update(logFile).set({ keychains: decoded.keychains }).where(eq(logFile.id, known.id));
      }
    } else {
      await tx
        .insert(logFile)
        .values({
          sha256: sha,
          fileName: input.fileName,
          sizeBytes: input.bytes.byteLength,
          logVersion: decoded.version,
          keychains: decoded.keychains,
          uploadedBy: input.pilotId,
        })
        .onConflictDoNothing();
    }
    return tx.insert(flight).values(rows).onConflictDoNothing().returning({
      id: flight.id,
      takeoffAt: flight.takeoffAt,
      durationSec: flight.durationSec,
      takeoffPlace: flight.takeoffPlace,
      timeZone: flight.timeZone,
    });
  });

  // A parallel upload of the same file won the race: report it as a duplicate.
  if (inserted.length === 0) return { status: "duplicate", flights: await existingFlights(sha) };

  await archiveRawLog(sha, input.bytes);
  return { status: "imported", aircraftName: plane.name, estimated, flights: inserted };
}

async function archiveRawLog(sha: string, bytes: Uint8Array) {
  try {
    const dir = path.join(dataDir(), "logs");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${sha}.txt`), bytes);
  } catch (error) {
    console.error("[ingest] could not archive raw log", { sha, error: String(error) });
  }
}


/** Original log archived at import time, or null if it was never kept. */
async function readArchivedLog(sha: string): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await readFile(path.join(dataDir(), "logs", `${sha}.txt`)));
  } catch {
    return null;
  }
}

export class ReprocessError extends Error {}

/**
 * Rebuild every flight of one log from the archived original — e.g. after the
 * DJI API key was added, to replace header-only estimates with decrypted data.
 * Pilot-entered fields survive; signatures are cleared because the data changed.
 */
export async function reprocessLog(sha: string): Promise<ImportedFlight[]> {
  const bytes = await readArchivedLog(sha);
  if (!bytes) throw new ReprocessError("The original log file is no longer stored on the server — import it again.");

  const old = await db.query.flight.findMany({ where: like(flight.sourceKey, `${sha}:%`) });
  if (old.length === 0) throw new ReprocessError("No flights from this log.");
  const keep = old[0];
  const fileName = keep.logFileName ?? `${sha}.txt`;

  await db.delete(flight).where(like(flight.sourceKey, `${sha}:%`));
  let result: IngestResult;
  try {
    result = await ingestLog({ bytes, fileName, pilotId: keep.pilotId });
  } catch (error) {
    // Put the previous rows back so a failed re-process never loses flights.
    await db.insert(flight).values(old).onConflictDoNothing();
    throw error;
  }
  if (result.status !== "imported") {
    await db.insert(flight).values(old).onConflictDoNothing();
    throw new ReprocessError(result.status === "empty" ? result.message : "Nothing to re-process.");
  }

  const kinds = new Set(keep.specificFlights);
  for (const f of result.flights) {
    const fresh = await db.query.flight.findFirst({ where: eq(flight.id, f.id) });
    await db
      .update(flight)
      .set({
        aircraftId: keep.aircraftId,
        purpose: keep.purpose,
        route: keep.route,
        remarks: keep.remarks,
        specificFlights: [...new Set([...kinds, ...(fresh?.specificFlights ?? [])])],
      })
      .where(eq(flight.id, f.id));
  }
  return result.flights;
}
