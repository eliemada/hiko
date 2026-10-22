import { ChevronLeft, ChevronRight, FileSpreadsheet, FileText, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { inArray } from "drizzle-orm";
import { PageHeader } from "@/components/bilingual";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { paginateJournal } from "@/lib/flight/journal";
import { loadJournal } from "@/lib/server/journal";
import { listAircraft } from "@/lib/server/queries";
import { requireUser } from "@/lib/server/session";
import { cn } from "@/lib/utils";
import { AircraftPicker, PrintButton } from "./controls";
import { JournalSheet } from "./journal-sheet";

export const metadata: Metadata = { title: "Journey Log" };

export default async function LogPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireUser();
  const sp = await searchParams;
  const planes = await listAircraft(true);

  if (planes.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title="Journey Log" />
        <p className="text-sm text-muted-foreground">
          No aircraft yet. <Link href="/import" className="text-primary hover:underline">Import a flight</Link> or{" "}
          <Link href="/aircraft" className="text-primary hover:underline">add an aircraft</Link>.
        </p>
      </div>
    );
  }

  const requested = typeof sp.aircraft === "string" ? sp.aircraft : undefined;
  const aircraftId = planes.some((p) => p.id === requested) ? requested! : planes[0].id;
  const journal = await loadJournal(aircraftId);
  if (!journal) return null;

  const flights = journal.flights;
  const pilotIds = [...new Set(flights.map((f) => f.pilotId))];
  const sigRows = pilotIds.length
    ? await db.select({ id: user.id, signature: user.signature }).from(user).where(inArray(user.id, pilotIds))
    : [];
  const signatures = Object.fromEntries(sigRows.map((r) => [r.id, r.signature]));

  const pages = paginateJournal(flights, journal.squawks);
  const current = Math.min(Math.max(1, Number(sp.page) || pages.length), pages.length);
  const unsigned = flights.filter((f) => !f.signedAt).length;
  const href = (n: number) => `/log?aircraft=${aircraftId}&page=${n}`;

  return (
    <div className="space-y-6">
      <div className="no-print space-y-6">
        <PageHeader
          kicker="MLIT Form 1 · 様式1"
          title="Journey Log"
          description="Your flight record in MLIT Form 1 format, one per aircraft — 15 flights per sheet with lifetime totals. Export a print-ready PDF logbook or the official Excel sheet."
          actions={
            <div className="grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:flex-wrap md:items-center">
              <div className="col-span-2 md:col-span-1">
                <AircraftPicker
                  value={aircraftId}
                  options={planes.map((p) => ({ id: p.id, name: p.registrationId ? `${p.name} · ${p.registrationId}` : p.name }))}
                />
              </div>
              <Button asChild size="lg" className="col-span-2 h-12 md:order-last md:col-span-1 md:h-9">
                <a href={`/api/export/pdf?aircraft=${aircraftId}`} target="_blank" rel="noreferrer">
                  <FileText /> PDF logbook
                </a>
              </Button>
              <Button variant="outline" asChild className="h-11 md:h-9">
                <a href={`/api/export/xlsx?aircraft=${aircraftId}`}>
                  <FileSpreadsheet /> Excel<span className="hidden md:inline"> (official template)</span>
                </a>
              </Button>
              <PrintButton />
            </div>
          }
        />
        {unsigned > 0 && (
          <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/8 px-3 py-2 text-sm">
            <TriangleAlert className="size-4 text-warning" />
            <span>
              {unsigned} unsigned flight{unsigned > 1 ? "s" : ""} — sheets containing them are marked as draft (下書き).
            </span>
            <Link href={`/flights?aircraft=${aircraftId}&unsigned=1`} className="ml-auto font-medium text-primary hover:underline">
              Review →
            </Link>
          </div>
        )}
        {!journal.aircraft.registrationId && (
          <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
            <TriangleAlert className="size-4" /> No registration ID (JU…) set for this aircraft.
            <Link href="/aircraft" className="ml-auto font-medium text-primary hover:underline">Add it →</Link>
          </div>
        )}
      </div>

      <p className="no-print text-xs text-muted-foreground md:hidden">Preview of the official sheet — scroll sideways, or open the PDF.</p>
      <div className="-mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        <div className="min-w-[880px] space-y-6">
          {pages.map((p) => (
            <div key={p.number} className={cn(p.number !== current && "hidden print:block", "print:break-after-page")}>
              <JournalSheet
                number={p.number}
                aircraftLabel={journal.label}
                flights={p.flights}
                squawks={p.squawks}
                signatures={signatures}
                draft={p.flights.some((f) => !f.signedAt)}
              />
            </div>
          ))}
        </div>
      </div>

      {pages.length > 1 && (
        <nav className="no-print flex items-center justify-center gap-3" aria-label="Sheets">
          <Button variant="outline" size="icon" asChild aria-disabled={current <= 1}>
            <Link href={href(Math.max(1, current - 1))} aria-label="Previous sheet">
              <ChevronLeft />
            </Link>
          </Button>
          <span className="text-sm tnum">
            NR. {current} / {pages.length}
          </span>
          <Button variant="outline" size="icon" asChild aria-disabled={current >= pages.length}>
            <Link href={href(Math.min(pages.length, current + 1))} aria-label="Next sheet">
              <ChevronRight />
            </Link>
          </Button>
        </nav>
      )}
    </div>
  );
}
