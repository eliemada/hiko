import "server-only";
import { DJILog, type KeychainFeaturePoint } from "dji-log-parser-js";
import type { FrameLike } from "../flight/types";
import { bestSerial, componentSerials } from "./serials";

/** Logs from version 13 on are AES-encrypted; their keys come from DJI's API. */
export const ENCRYPTED_FROM_VERSION = 13;

export class LogDecodeError extends Error {
  constructor(
    message: string,
    readonly code: "invalid" | "keychain_failed" | "decode_failed",
  ) {
    super(message);
    this.name = "LogDecodeError";
  }
}

/** Unencrypted header summary — available even without a DJI API key. */
export interface LogHeader {
  startTime: number | null;
  totalTimeSec: number;
  latitude: number;
  longitude: number;
  maxHeight: number;
  totalDistance: number;
  maxHorizontalSpeed: number;
}

export interface DecodedLog {
  version: number;
  header: LogHeader;
  aircraftName: string;
  aircraftSerial: string;
  batterySerial: string;
  appVersion: string;
  /** null when the log is encrypted and no API key is configured. */
  frames: FrameLike[] | null;
  keychains: KeychainFeaturePoint[][] | null;
}

function openLog(bytes: Uint8Array): DJILog {
  let log: DJILog;
  try {
    log = new DJILog(bytes);
  } catch (error) {
    throw new LogDecodeError(
      `Not a DJI flight record (${error instanceof Error ? error.message : String(error)})`,
      "invalid",
    );
  }
  // The parser accepts arbitrary bytes and reports version 0 for them.
  if (log.version < 1 || !log.details.startTime) {
    log.free();
    throw new LogDecodeError("Not a DJI flight record.", "invalid");
  }
  return log;
}

function readHeader(log: DJILog): LogHeader {
  const d = log.details;
  const start = Date.parse(d.startTime);
  return {
    startTime: Number.isFinite(start) ? start : null,
    totalTimeSec: d.totalTime ?? 0,
    latitude: d.latitude ?? 0,
    longitude: d.longitude ?? 0,
    maxHeight: d.maxHeight ?? 0,
    totalDistance: d.totalDistance ?? 0,
    maxHorizontalSpeed: d.maxHorizontalSpeed ?? 0,
  };
}

export function hasDjiApiKey(): boolean {
  return Boolean(process.env.DJI_API_KEY);
}

async function resolveKeychains(
  log: DJILog,
  cached: KeychainFeaturePoint[][] | null,
): Promise<KeychainFeaturePoint[][] | null> {
  if (log.version < ENCRYPTED_FROM_VERSION) return null;
  if (cached) return cached;
  const apiKey = process.env.DJI_API_KEY;
  if (!apiKey) return null;
  try {
    return await log.fetchKeychains(apiKey);
  } catch (error) {
    throw new LogDecodeError(
      `DJI refused the keychain request: ${error instanceof Error ? error.message : String(error)}`,
      "keychain_failed",
    );
  }
}

/**
 * Decode a DJI Fly `FlightRecord_*.txt`. `cachedKeychains` lets an already
 * imported log be re-decoded without calling DJI again.
 */
export async function decodeDjiLog(
  bytes: Uint8Array,
  cachedKeychains: KeychainFeaturePoint[][] | null = null,
): Promise<DecodedLog> {
  const log = openLog(bytes);
  try {
    const keychains = await resolveKeychains(log, cachedKeychains);
    const encryptedWithoutKey = log.version >= ENCRYPTED_FROM_VERSION && !keychains;
    let frames: FrameLike[] | null = null;
    let serials: ReturnType<typeof componentSerials> = {};
    try {
      if (!encryptedWithoutKey) {
        frames = (keychains ? log.frames(keychains) : log.frames()) as unknown as FrameLike[];
        serials = componentSerials(keychains ? log.records(keychains) : log.records());
      }
    } catch (error) {
      throw new LogDecodeError(
        `Could not decode frames: ${error instanceof Error ? error.message : String(error)}`,
        "decode_failed",
      );
    }
    const details = log.details;
    return {
      version: log.version,
      header: readHeader(log),
      aircraftName: details.aircraftName?.trim() ?? "",
      aircraftSerial: bestSerial(details.aircraftSn?.trim() ?? "", serials.aircraft),
      batterySerial: bestSerial(details.batterySn?.trim() ?? "", serials.battery),
      appVersion: details.appVersion ?? "",
      frames,
      keychains,
    };
  } finally {
    log.free();
  }
}
