import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { SpecificFlightKind } from "../flight/kinds";
import type { FlightWarning, TrackPoint } from "../flight/types";

export { SPECIFIC_FLIGHT_KINDS, type SpecificFlightKind } from "../flight/kinds";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`);
const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date());

/* ───────────── Better Auth ───────────── */

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("pilot"),
  /** 技能証明番号 — printed next to the pilot's name (③). */
  licenseNumber: text("license_number"),
  /** PNG data URL drawn on the signature pad (⑪). */
  signature: text("signature"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

/* ───────────── Fleet ───────────── */

export const aircraft = sqliteTable(
  "aircraft",
  {
    id: id(),
    /** Friendly name, e.g. "Mavic 4 Pro #1". */
    name: text("name").notNull(),
    model: text("model").notNull().default(""),
    /** 登録記号 (JU…) — ① on the journey log. */
    registrationId: text("registration_id").notNull().default(""),
    /** DJI aircraft serial, used to match imported logs to this aircraft. */
    serialNumber: text("serial_number").notNull().default(""),
    /** Hours flown before the app started tracking (carried into ⑩ 総飛行時間). */
    initialSeconds: integer("initial_seconds").notNull().default(0),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  // One aircraft per DJI serial; aircraft without a serial (manual) are exempt.
  (t) => [uniqueIndex("aircraft_serial_unique").on(t.serialNumber).where(sql`${t.serialNumber} <> ''`)],
);


export interface FlightWeather {
  temperatureC: number | null;
  windSpeedMs: number | null;
  windGustMs: number | null;
  windDirectionDeg: number | null;
  precipitationMm: number | null;
  weatherCode: number | null;
}

export const flight = sqliteTable(
  "flight",
  {
    id: id(),
    aircraftId: text("aircraft_id")
      .notNull()
      .references(() => aircraft.id, { onDelete: "restrict" }),
    pilotId: text("pilot_id")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    source: text("source", { enum: ["dji_log", "manual"] }).notNull(),
    /** sha256 of the log + segment index; prevents importing the same flight twice. */
    sourceKey: text("source_key"),
    logFileName: text("log_file_name"),

    takeoffAt: integer("takeoff_at").notNull(),
    landingAt: integer("landing_at").notNull(),
    durationSec: integer("duration_sec").notNull(),
    timeZone: text("time_zone").notNull().default("Asia/Tokyo"),

    takeoffLat: real("takeoff_lat"),
    takeoffLng: real("takeoff_lng"),
    landingLat: real("landing_lat"),
    landingLng: real("landing_lng"),
    takeoffPlace: text("takeoff_place").notNull().default(""),
    landingPlace: text("landing_place").notNull().default(""),

    /** ④ 飛行目的 — free text such as 訓練, 空撮, 点検. */
    purpose: text("purpose").notNull().default(""),
    specificFlights: text("specific_flights", { mode: "json" })
      .$type<SpecificFlightKind[]>()
      .notNull()
      .default(sql`'[]'`),
    /** Extra route info (経由地 etc.) appended to ④. */
    route: text("route").notNull().default(""),
    /** ⑫ 飛行の安全に影響のあった事項. */
    safetyNotes: text("safety_notes").notNull().default(""),
    /** ⑬ 記事 / free remarks. */
    remarks: text("remarks").notNull().default(""),

    maxHeight: real("max_height"),
    maxDistance: real("max_distance"),
    maxSpeed: real("max_speed"),
    totalDistance: real("total_distance"),
    batteryStart: integer("battery_start"),
    batteryEnd: integer("battery_end"),
    batterySerial: text("battery_serial"),
    warnings: text("warnings", { mode: "json" }).$type<FlightWarning[]>().notNull().default(sql`'[]'`),
    weather: text("weather", { mode: "json" }).$type<FlightWeather | null>(),
    track: text("track", { mode: "json" }).$type<TrackPoint[]>().notNull().default(sql`'[]'`),

    /** ⑪ — set when the pilot signs; locks the core fields. */
    signedAt: integer("signed_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("flight_source_key_idx").on(t.sourceKey),
    index("flight_aircraft_takeoff_idx").on(t.aircraftId, t.takeoffAt),
    index("flight_pilot_idx").on(t.pilotId),
  ],
);

/** Raw DJI log kept for audit + the keychain so it can be re-decoded offline. */
export const logFile = sqliteTable("log_file", {
  id: id(),
  sha256: text("sha256").notNull().unique(),
  fileName: text("file_name").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  logVersion: integer("log_version").notNull(),
  keychains: text("keychains", { mode: "json" }),
  uploadedBy: text("uploaded_by")
    .notNull()
    .references(() => user.id, { onDelete: "restrict" }),
  createdAt: createdAt(),
});

/** 不具合事項 / 処置 — the REPORT block under the journey log. */
export const squawk = sqliteTable(
  "squawk",
  {
    id: id(),
    aircraftId: text("aircraft_id")
      .notNull()
      .references(() => aircraft.id, { onDelete: "restrict" }),
    flightId: text("flight_id").references(() => flight.id, { onDelete: "set null" }),
    occurredOn: text("occurred_on").notNull(),
    description: text("description").notNull(),
    actionOn: text("action_on"),
    action: text("action"),
    confirmer: text("confirmer"),
    reportedBy: text("reported_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("squawk_aircraft_idx").on(t.aircraftId, t.occurredOn)],
);

export type Aircraft = typeof aircraft.$inferSelect;
export type Flight = typeof flight.$inferSelect;
export type NewFlight = typeof flight.$inferInsert;
export type Squawk = typeof squawk.$inferSelect;
export type User = typeof user.$inferSelect;
