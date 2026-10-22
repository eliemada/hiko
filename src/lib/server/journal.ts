import "server-only";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { aircraft } from "../db/schema";
import type { JournalFlight, JournalSquawk } from "../export/journal-rows";
import { listFlights, listSquawks } from "./queries";

/** ① — registration plus model/serial, as the template asks. */
export function aircraftLabel(a: { registrationId: string; model: string; name: string; serialNumber: string }) {
  const model = a.model || a.name;
  const serial = a.serialNumber ? ` S/N ${a.serialNumber}` : "";
  return a.registrationId ? `${a.registrationId}（${model}${serial}）` : `${model}${serial}`;
}

export async function loadJournal(aircraftId: string) {
  const plane = await db.query.aircraft.findFirst({ where: eq(aircraft.id, aircraftId) });
  if (!plane) return null;
  const [flights, squawks] = await Promise.all([listFlights({ aircraftId }, "asc"), listSquawks(aircraftId)]);
  const journalFlights: (JournalFlight & { id: string; pilotId: string })[] = flights.map((f) => ({
    id: f.id,
    pilotId: f.pilotId,
    takeoffAt: f.takeoffAt,
    landingAt: f.landingAt,
    durationSec: f.durationSec,
    totalSec: f.totalSec,
    timeZone: f.timeZone,
    pilotName: f.pilotName,
    pilotLicense: f.pilotLicense,
    purpose: f.purpose,
    specificFlights: f.specificFlights,
    route: f.route,
    takeoffPlace: f.takeoffPlace,
    landingPlace: f.landingPlace,
    safetyNotes: f.safetyNotes,
    signedAt: f.signedAt,
  }));
  const journalSquawks: JournalSquawk[] = squawks.map(({ squawk: s }) => ({
    occurredOn: s.occurredOn,
    description: s.description,
    actionOn: s.actionOn,
    action: s.action,
    confirmer: s.confirmer,
  }));
  return { aircraft: plane, label: aircraftLabel(plane), flights: journalFlights, squawks: journalSquawks };
}
