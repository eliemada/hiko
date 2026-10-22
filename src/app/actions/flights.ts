"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { flight, user } from "@/lib/db/schema";
import { zonedTimeToEpoch } from "@/lib/datetime";
import { reprocessLog, ReprocessError } from "@/lib/server/ingest";
import { LogDecodeError } from "@/lib/dji/decode";
import { requireUser, type CurrentUser } from "@/lib/server/session";
import tzlookup from "@photostructure/tz-lookup";
import { reverseGeocode } from "@/lib/enrich/geocode";
import { fetchWeather, weatherSummary } from "@/lib/enrich/weather";
import { isNight } from "@/lib/flight/geo";
import type { SpecificFlightKind } from "@/lib/flight/kinds";
import { defaultSafetyNotes } from "@/lib/flight/suggest";
import { flightEditSchema, locationPrefillSchema, manualFlightSchema, type FlightEdit } from "@/lib/validation";
import { fail, UserError, type ActionResult } from "./result";

async function loadEditable(id: string, me: CurrentUser) {
  const row = await db.query.flight.findFirst({ where: eq(flight.id, id) });
  if (!row) throw new UserError("Flight not found");
  if (row.pilotId !== me.id && me.role !== "admin") throw new UserError("Only the pilot or an admin can change this flight");
  return row;
}

function refresh(id?: string) {
  revalidatePath("/", "layout");
  if (id) revalidatePath(`/flights/${id}`);
}

export async function updateFlight(id: string, input: FlightEdit): Promise<ActionResult> {
  try {
    const me = await requireUser();
    const row = await loadEditable(id, me);
    if (row.signedAt) throw new UserError("Signed flights are locked — remove the signature to edit");
    const data = flightEditSchema.parse(input);
    if (data.pilotId !== row.pilotId && me.role !== "admin") throw new UserError("Only an admin can reassign the pilot");
    await db.update(flight).set(data).where(eq(flight.id, id));
    refresh(id);
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}

export async function signFlight(id: string): Promise<ActionResult> {
  try {
    const me = await requireUser();
    const row = await db.query.flight.findFirst({ where: eq(flight.id, id) });
    if (!row) throw new UserError("Flight not found");
    if (row.pilotId !== me.id) throw new UserError("Only the pilot who flew can sign (⑪)");
    if (!row.purpose.trim()) throw new UserError("Fill in the nature of flight (④) before signing");
    const pilot = await db.query.user.findFirst({ where: eq(user.id, me.id) });
    if (!pilot?.signature) throw new UserError("Draw your signature in Settings first");
    await db.update(flight).set({ signedAt: new Date() }).where(eq(flight.id, id));
    refresh(id);
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}

export async function unsignFlight(id: string): Promise<ActionResult> {
  try {
    const me = await requireUser();
    await loadEditable(id, me);
    await db.update(flight).set({ signedAt: null }).where(eq(flight.id, id));
    refresh(id);
    return { success: true };
  } catch (error) {
    return fail(error);
  }
}

export async function signAllMine(): Promise<ActionResult<{ count: number }>> {
  try {
    const me = await requireUser();
    const pilot = await db.query.user.findFirst({ where: eq(user.id, me.id) });
    if (!pilot?.signature) throw new UserError("Draw your signature in Settings first");
    const pending = await db.query.flight.findMany({ where: (f, { and, eq, isNull }) => and(eq(f.pilotId, me.id), isNull(f.signedAt)) });
    const ready = pending.filter((f) => f.purpose.trim());
    const now = new Date();
    for (const f of ready) await db.update(flight).set({ signedAt: now }).where(eq(flight.id, f.id));
    refresh();
    return { success: true, data: { count: ready.length } };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteFlight(id: string): Promise<ActionResult> {
  try {
    const me = await requireUser();
    const row = await loadEditable(id, me);
    if (row.signedAt) throw new UserError("Remove the signature before deleting");
    await db.delete(flight).where(eq(flight.id, id));
    refresh();
  } catch (error) {
    return fail(error);
  }
  redirect("/flights");
}

export async function createManualFlight(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await requireUser();
    const data = manualFlightSchema.parse(input);
    if (data.pilotId !== me.id && me.role !== "admin") throw new UserError("Only an admin can log flights for others");
    try {
      new Intl.DateTimeFormat("en", { timeZone: data.timeZone });
    } catch {
      throw new UserError("Unknown time zone");
    }
    const takeoffAt = zonedTimeToEpoch(data.date, data.takeoffTime, data.timeZone);
    let landingAt = zonedTimeToEpoch(data.date, data.landingTime, data.timeZone);
    if (landingAt <= takeoffAt) landingAt += 86_400_000; // crossed midnight
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { date: _d, takeoffTime: _t, landingTime: _l, takeoffLat, takeoffLng, ...rest } = data;
    const hasPoint = takeoffLat !== undefined && takeoffLng !== undefined;
    const weather = hasPoint ? await fetchWeather(takeoffLat, takeoffLng, takeoffAt) : null;
    const [row] = await db
      .insert(flight)
      .values({
        ...rest,
        source: "manual",
        takeoffAt,
        landingAt,
        durationSec: Math.round((landingAt - takeoffAt) / 1000),
        ...(hasPoint ? { takeoffLat, takeoffLng, landingLat: takeoffLat, landingLng: takeoffLng, weather } : {}),
      })
      .returning({ id: flight.id });
    refresh();
    return { success: true, data: { id: row.id } };
  } catch (error) {
    return fail(error);
  }
}

export async function reprocessFlight(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await requireUser();
    const row = await loadEditable(id, me);
    const sha = row.source === "dji_log" ? row.sourceKey?.split(":")[0] : undefined;
    if (!sha) throw new UserError("Only flights imported from a DJI log can be re-processed");
    let flights;
    try {
      flights = await reprocessLog(sha);
    } catch (error) {
      if (error instanceof ReprocessError || error instanceof LogDecodeError) throw new UserError(error.message);
      throw error;
    }
    refresh();
    return { success: true, data: { id: flights[0].id } };
  } catch (error) {
    return fail(error);
  }
}

export interface LocationPrefill {
  place: string;
  timeZone: string;
  safetyNotes: string;
  suggested: SpecificFlightKind[];
}

/** "Use my location" on manual entry: address, zone, weather and night check for a point. */
export async function prefillFromLocation(input: unknown): Promise<ActionResult<LocationPrefill>> {
  try {
    await requireUser();
    const { lat, lng, at } = locationPrefillSchema.parse(input);
    let timeZone = "UTC";
    try {
      timeZone = tzlookup(lat, lng);
    } catch {
      /* ocean / poles: keep UTC */
    }
    const [place, weather] = await Promise.all([reverseGeocode(lat, lng), fetchWeather(lat, lng, at)]);
    return {
      success: true,
      data: {
        place,
        timeZone,
        safetyNotes: defaultSafetyNotes(weatherSummary(weather), []),
        suggested: isNight(at, lat, lng) ? ["night"] : [],
      },
    };
  } catch (error) {
    return fail(error);
  }
}
