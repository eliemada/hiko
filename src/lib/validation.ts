import { z } from "zod";
import { SPECIFIC_FLIGHT_KINDS } from "./flight/kinds";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .refine((v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
  }, "Invalid date");
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (00:00–23:59)");
const text = (max: number) => z.string().trim().max(max);

export const flightEditSchema = z.object({
  purpose: text(200),
  specificFlights: z.array(z.enum(SPECIFIC_FLIGHT_KINDS)).max(SPECIFIC_FLIGHT_KINDS.length),
  route: text(300),
  takeoffPlace: text(200),
  landingPlace: text(200),
  safetyNotes: text(1000),
  remarks: text(1000),
  aircraftId: z.string().min(1),
  pilotId: z.string().min(1),
});
export type FlightEdit = z.infer<typeof flightEditSchema>;

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);

export const manualFlightSchema = flightEditSchema.extend({
  date: isoDate,
  takeoffTime: hhmm,
  landingTime: hhmm,
  timeZone: z.string().min(1).max(64),
  /** From "Use my location" — lets the flight show on the map and get weather. */
  takeoffLat: lat.optional(),
  takeoffLng: lng.optional(),
});

export const locationPrefillSchema = z.object({ lat, lng, at: z.number().int().positive() });

export const aircraftSchema = z.object({
  name: text(80).min(1, "Name is required"),
  model: text(80),
  registrationId: text(40),
  serialNumber: text(60),
  initialHours: z.coerce.number().min(0).max(100_000),
});

export const squawkSchema = z.object({
  aircraftId: z.string().min(1),
  occurredOn: isoDate,
  description: text(500).min(1, "Describe the issue"),
  actionOn: isoDate.or(z.literal("")).optional(),
  action: text(500).optional(),
  confirmer: text(80).optional(),
});

export const profileSchema = z.object({
  name: text(80).min(1),
  licenseNumber: text(40),
});

/** PNG data URL from the signature pad, capped at ~200 KB. */
export const signatureSchema = z
  .string()
  .max(200_000)
  .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, "Invalid signature image");

export const signUpSchema = z.object({
  name: text(80).min(1),
  email: z.email(),
  password: z.string().min(10, "At least 10 characters").max(128),
  inviteCode: z.string().max(200),
});
