import type { SpecificFlightKind } from "../flight/kinds";
import { formatHoursMinutes, formatLogDate, formatLogTime } from "../flight/format";
import { natureOfFlight } from "../flight/suggest";

/** What one line of the MLIT journey log needs. */
export interface JournalFlight {
  takeoffAt: number;
  landingAt: number;
  durationSec: number;
  totalSec: number;
  timeZone: string;
  pilotName: string;
  pilotLicense: string | null;
  purpose: string;
  specificFlights: SpecificFlightKind[];
  route: string;
  takeoffPlace: string;
  landingPlace: string;
  safetyNotes: string;
  signedAt: Date | null;
}

export interface JournalSquawk {
  occurredOn: string;
  description: string;
  actionOn: string | null;
  action: string | null;
  confirmer: string | null;
}

export interface JournalRow {
  date: string;
  pilot: string;
  nature: string;
  from: string;
  to: string;
  off: string;
  on: string;
  flightTime: string;
  totalTime: string;
  safety: string;
  signed: boolean;
}

export function toJournalRow(f: JournalFlight): JournalRow {
  return {
    date: formatLogDate(f.takeoffAt, f.timeZone),
    pilot: f.pilotLicense ? `${f.pilotName}（${f.pilotLicense}）` : f.pilotName,
    nature: natureOfFlight(f.purpose, f.specificFlights, f.route),
    from: f.takeoffPlace,
    to: f.landingPlace,
    off: formatLogTime(f.takeoffAt, f.timeZone),
    on: formatLogTime(f.landingAt, f.timeZone),
    flightTime: formatHoursMinutes(f.durationSec),
    totalTime: formatHoursMinutes(f.totalSec),
    safety: f.safetyNotes.replace(/\s*\n\s*/g, " / "),
    signed: f.signedAt !== null,
  };
}

const slashDate = (iso: string | null) => (iso ? iso.replaceAll("-", "/") : "");

export function toSquawkRow(s: JournalSquawk) {
  return {
    date: slashDate(s.occurredOn),
    description: s.description,
    actionDate: slashDate(s.actionOn),
    action: s.action ?? "",
    confirmer: s.confirmer ?? "",
  };
}
