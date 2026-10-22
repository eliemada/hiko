import { Plus, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/bilingual";
import { SignedBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { formatDurationLong, formatHoursMinutes, formatLogDate, formatLogTime, isoDate } from "@/lib/flight/format";
import { listAircraft, listFlights, listPilots } from "@/lib/server/queries";
import { requireUser } from "@/lib/server/session";
import { FlightFilters } from "./filters";
import { SignAllButton } from "./sign-all";

export const metadata: Metadata = { title: "Flights" };

const PAGE_SIZE = 50;

const isIsoDay = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
/** Coarse SQL bound that is safe for any time zone (±14 h); refined per flight below. */
const coarse = (iso: string, endOfDay: boolean) =>
  Date.parse(`${iso}T00:00:00Z`) + (endOfDay ? 38 : -14) * 3_600_000;

/** "October 2026" buckets in each flight's local calendar, newest first (input is already sorted). */
function groupByMonth<T extends { takeoffAt: number; timeZone: string }>(rows: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const f of rows) {
    const label = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: f.timeZone }).format(f.takeoffAt);
    groups.set(label, [...(groups.get(label) ?? []), f]);
  }
  return [...groups.entries()];
}

export default async function FlightsPage({ searchParams }: PageProps<"/flights">) {
  const me = await requireUser();
  const sp = await searchParams;
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const page = Math.max(1, Number(get("page") ?? 1) || 1);
  const filters = {
    aircraftId: get("aircraft"),
    pilotId: get("pilot") === "me" ? me.id : get("pilot"),
    from: isIsoDay(get("from")) ? coarse(get("from")!, false) : undefined,
    to: isIsoDay(get("to")) ? coarse(get("to")!, true) : undefined,
    unsignedOnly: get("unsigned") === "1",
  };

  const [candidates, planes, pilots] = await Promise.all([listFlights(filters), listAircraft(true), listPilots()]);
  const fromDay = get("from");
  const toDay = get("to");
  // Compare in each flight's local calendar, as written in the log.
  const flights = candidates.filter((f) => {
    const day = isoDate(f.takeoffAt, f.timeZone);
    return (!isIsoDay(fromDay) || day >= fromDay) && (!isIsoDay(toDay) || day <= toDay);
  });
  const shown = flights.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(flights.length / PAGE_SIZE));
  const myUnsigned = flights.filter((f) => f.pilotId === me.id && !f.signedAt).length;
  const filtered = Object.values(filters).some((v) => v !== undefined && v !== false);
  const totalSec = flights.reduce((s, f) => s + f.durationSec, 0);

  const pageHref = (n: number) => {
    const q = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
    q.set("page", String(n));
    return `/flights?${q}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Flights"
        description={
          <span className="tnum">
            {flights.length} flights · {formatHoursMinutes(totalSec)} airtime{filtered ? " (filtered)" : ""}
          </span>
        }
        actions={
          <>
            {myUnsigned > 0 && <SignAllButton count={myUnsigned} />}
            <Button variant="outline" asChild className="hidden md:inline-flex">
              <Link href="/flights/new">
                <Plus /> Manual entry
              </Link>
            </Button>
            <Button asChild className="hidden md:inline-flex">
              <Link href="/import">
                <Upload /> Import
              </Link>
            </Button>
          </>
        }
      />

      <FlightFilters aircraft={planes.map((a) => ({ id: a.id, name: a.name }))} pilots={pilots.map((p) => ({ id: p.id, name: p.name }))} />

      {flights.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-[10px] border border-dashed bg-card py-16 text-center">
          <p className="font-medium">{filtered ? "No flights match these filters" : "No flights yet"}</p>
          <p className="text-sm text-muted-foreground">
            {filtered ? "Try clearing a filter." : "Import your first DJI flight record to start the log."}
          </p>
          <Button asChild variant={filtered ? "outline" : "default"}>
            <Link href={filtered ? "/flights" : "/import"}>{filtered ? "Clear filters" : "Import your first flight"}</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-[10px] border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/60 text-left backdrop-blur">
                <tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:text-xs [&>th]:font-medium [&>th]:text-muted-foreground">
                  <th>Date</th>
                  <th>Pilot</th>
                  <th>Aircraft</th>
                  <th>Purpose · Takeoff place</th>
                  <th className="text-right">Off – On</th>
                  <th className="text-right">Flight time</th>
                  <th className="text-right">Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {shown.map((f) => (
                  <tr key={f.id} className="group relative h-10 transition-colors hover:bg-accent/50 [&>td]:px-3 [&>td]:py-2">
                    <td className="font-medium whitespace-nowrap tnum">
                      <Link href={`/flights/${f.id}`} className="after:absolute after:inset-0 focus-visible:outline-none">
                        {formatLogDate(f.takeoffAt, f.timeZone)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap">{f.pilotName}</td>
                    <td className="whitespace-nowrap text-muted-foreground">{f.registrationId || f.aircraftName}</td>
                    <td className="max-w-72 truncate" title={f.takeoffPlace}>
                      {f.purpose ? <span className="mr-1.5 font-medium">{f.purpose}</span> : null}
                      <span className="text-muted-foreground">{f.takeoffPlace}</span>
                    </td>
                    <td className="text-right whitespace-nowrap tnum">
                      {formatLogTime(f.takeoffAt, f.timeZone)}–{formatLogTime(f.landingAt, f.timeZone)}
                    </td>
                    <td className="text-right tnum">{formatDurationLong(f.durationSec)}</td>
                    <td className="text-right text-muted-foreground tnum">{formatHoursMinutes(f.totalSec)}</td>
                    <td>
                      <SignedBadge signed={!!f.signedAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone: one list grouped by month, thumb-sized rows. */}
          <div className="space-y-5 md:hidden">
            {groupByMonth(shown).map(([month, rows]) => (
              <section key={month}>
                <h2 className="mb-1.5 flex items-baseline justify-between px-1 text-[13px] font-medium text-muted-foreground">
                  {month}
                  <span className="tnum">{formatHoursMinutes(rows.reduce((t, f) => t + f.durationSec, 0))}</span>
                </h2>
                <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                  {rows.map((f) => (
                    <li key={f.id}>
                      <Link href={`/flights/${f.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-accent">
                        <div className="w-11 shrink-0 text-center">
                          <div className="text-lg leading-6 font-semibold tnum">{formatLogDate(f.takeoffAt, f.timeZone).slice(8)}</div>
                          <div className="text-[11px] text-muted-foreground tnum">{formatLogTime(f.takeoffAt, f.timeZone)}</div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{f.purpose || <span className="text-warning">Purpose missing</span>}</div>
                          <div className="truncate text-xs text-muted-foreground">{f.takeoffPlace || "—"}</div>
                          <div className="truncate text-xs text-muted-foreground tnum">
                            {formatDurationLong(f.durationSec)} · {f.registrationId || f.aircraftName}
                            {f.pilotId !== me.id && ` · ${f.pilotName}`}
                          </div>
                        </div>
                        <SignedBadge signed={!!f.signedAt} compact />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {pages > 1 && (
            <nav className="flex items-center justify-center gap-2 text-sm" aria-label="Pagination">
              <Button variant="outline" size="sm" asChild disabled={page <= 1}>
                <Link href={pageHref(Math.max(1, page - 1))} aria-disabled={page <= 1}>
                  Previous
                </Link>
              </Button>
              <span className="text-muted-foreground tnum">
                {page} / {pages}
              </span>
              <Button variant="outline" size="sm" asChild>
                <Link href={pageHref(Math.min(pages, page + 1))} aria-disabled={page >= pages}>
                  Next
                </Link>
              </Button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
