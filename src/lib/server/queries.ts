import "server-only";
import { and, asc, desc, eq, getTableColumns, gte, isNull, lte, type SQL } from "drizzle-orm";
import { db } from "../db";
import { aircraft, flight, squawk, user, type Aircraft, type Flight } from "../db/schema";
import { withRunningTotals } from "../flight/journal";

export type FlightRow = Omit<Flight, "track"> & {
  pilotName: string;
  pilotLicense: string | null;
  aircraftName: string;
  registrationId: string;
  totalSec: number;
};

export interface FlightFilters {
  aircraftId?: string;
  pilotId?: string;
  from?: number;
  to?: number;
  unsignedOnly?: boolean;
}

export async function listAircraft(includeArchived = false): Promise<Aircraft[]> {
  return db
    .select()
    .from(aircraft)
    .where(includeArchived ? undefined : eq(aircraft.archived, false))
    .orderBy(asc(aircraft.name));
}

export async function listPilots() {
  return db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role, licenseNumber: user.licenseNumber })
    .from(user)
    .orderBy(asc(user.name));
}

/** ⑩ totals for every flight — needs the full history of each aircraft. */
async function totalsById(): Promise<Map<string, number>> {
  const [all, planes] = await Promise.all([
    db
      .select({ id: flight.id, aircraftId: flight.aircraftId, takeoffAt: flight.takeoffAt, durationSec: flight.durationSec })
      .from(flight),
    db.select({ id: aircraft.id, initialSeconds: aircraft.initialSeconds }).from(aircraft),
  ]);
  const initial = Object.fromEntries(planes.map((p) => [p.id, p.initialSeconds]));
  return new Map(withRunningTotals(all, initial).map((f) => [f.id, f.totalSec]));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { track: _track, ...flightColumns } = getTableColumns(flight);

export async function listFlights(filters: FlightFilters = {}, order: "asc" | "desc" = "desc"): Promise<FlightRow[]> {
  const where: SQL[] = [];
  if (filters.aircraftId) where.push(eq(flight.aircraftId, filters.aircraftId));
  if (filters.pilotId) where.push(eq(flight.pilotId, filters.pilotId));
  if (filters.from !== undefined) where.push(gte(flight.takeoffAt, filters.from));
  if (filters.to !== undefined) where.push(lte(flight.takeoffAt, filters.to));
  if (filters.unsignedOnly) where.push(isNull(flight.signedAt));

  const [rows, totals] = await Promise.all([
    db
      .select({
        ...flightColumns,
        pilotName: user.name,
        pilotLicense: user.licenseNumber,
        aircraftName: aircraft.name,
        registrationId: aircraft.registrationId,
      })
      .from(flight)
      .innerJoin(user, eq(user.id, flight.pilotId))
      .innerJoin(aircraft, eq(aircraft.id, flight.aircraftId))
      .where(where.length ? and(...where) : undefined)
      .orderBy(order === "asc" ? asc(flight.takeoffAt) : desc(flight.takeoffAt)),
    totalsById(),
  ]);
  return rows.map((r) => ({ ...r, totalSec: totals.get(r.id) ?? r.durationSec }));
}

export async function getFlight(id: string) {
  const [row] = await db
    .select({
      flight,
      pilotName: user.name,
      pilotLicense: user.licenseNumber,
      pilotSignature: user.signature,
      aircraft,
    })
    .from(flight)
    .innerJoin(user, eq(user.id, flight.pilotId))
    .innerJoin(aircraft, eq(aircraft.id, flight.aircraftId))
    .where(eq(flight.id, id));
  if (!row) return null;
  const totals = await totalsById();
  return { ...row, totalSec: totals.get(id) ?? row.flight.durationSec };
}

export async function listSquawks(aircraftId?: string) {
  return db
    .select({ squawk, aircraftName: aircraft.name, reporterName: user.name })
    .from(squawk)
    .innerJoin(aircraft, eq(aircraft.id, squawk.aircraftId))
    .innerJoin(user, eq(user.id, squawk.reportedBy))
    .where(aircraftId ? eq(squawk.aircraftId, aircraftId) : undefined)
    .orderBy(asc(squawk.occurredOn), asc(squawk.createdAt));
}

export async function dashboardData(userId: string) {
  const [flights, planes, squawks] = await Promise.all([listFlights(), listAircraft(), listSquawks()]);
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const perAircraft = planes.map((p) => {
    const own = flights.filter((f) => f.aircraftId === p.id);
    return {
      id: p.id,
      name: p.name,
      registrationId: p.registrationId,
      flights: own.length,
      totalSec: p.initialSeconds + own.reduce((s, f) => s + f.durationSec, 0),
    };
  });

  // Daily airtime for the last 12 weeks.
  const days = 84;
  const start = Date.now() - days * 86_400_000;
  const daily = Array.from({ length: days }, (_, i) => {
    const dayStart = start + i * 86_400_000;
    const sec = flights
      .filter((f) => f.takeoffAt >= dayStart && f.takeoffAt < dayStart + 86_400_000)
      .reduce((s, f) => s + f.durationSec, 0);
    return { day: new Date(dayStart).toISOString().slice(0, 10), minutes: Math.round(sec / 60) };
  });

  return {
    totalSec: flights.reduce((s, f) => s + f.durationSec, 0),
    totalFlights: flights.length,
    monthFlights: flights.filter((f) => f.takeoffAt >= monthStart.getTime()).length,
    monthSec: flights.filter((f) => f.takeoffAt >= monthStart.getTime()).reduce((s, f) => s + f.durationSec, 0),
    myUnsigned: flights.filter((f) => f.pilotId === userId && !f.signedAt).length,
    openSquawks: squawks.filter((s) => !s.squawk.actionOn).length,
    recent: flights.slice(0, 6),
    perAircraft,
    daily,
  };
}
