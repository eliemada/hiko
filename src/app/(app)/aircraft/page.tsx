import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/bilingual";
import { formatHoursMinutes } from "@/lib/flight/format";
import { listAircraft, listFlights } from "@/lib/server/queries";
import { requireUser } from "@/lib/server/session";
import { AircraftDialog } from "./aircraft-dialog";

export const metadata: Metadata = { title: "Aircraft" };

export default async function AircraftPage() {
  const me = await requireUser();
  const [planes, flights] = await Promise.all([listAircraft(true), listFlights()]);
  const isAdmin = me.role === "admin";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aircraft"
        description="Logs are matched to an aircraft by its DJI serial. Add the Japanese registration ID (JU…) and any hours flown before Hikō."
        actions={<AircraftDialog mode="create" />}
      />

      {planes.length === 0 ? (
        <div className="grid place-items-center gap-3 rounded-[10px] border border-dashed bg-card py-14 text-center">
          <p className="font-medium">No aircraft yet</p>
          <p className="text-sm text-muted-foreground">Add your Mavic 4 Pro now, or let the first import create it automatically.</p>
          <AircraftDialog mode="create" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {planes.map((p) => {
            const own = flights.filter((f) => f.aircraftId === p.id);
            const total = p.initialSeconds + own.reduce((s, f) => s + f.durationSec, 0);
            return (
              <div key={p.id} className={`rounded-[10px] border bg-card p-5 ${p.archived ? "opacity-60" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold">{p.name}</div>
                    <div className="text-sm text-muted-foreground">{p.model || "—"}</div>
                  </div>
                  {isAdmin && (
                    <AircraftDialog
                      mode="edit"
                      aircraft={{
                        id: p.id,
                        name: p.name,
                        model: p.model,
                        registrationId: p.registrationId,
                        serialNumber: p.serialNumber,
                        initialHours: Math.round((p.initialSeconds / 3600) * 100) / 100,
                        archived: p.archived,
                      }}
                    />
                  )}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="label-en">Registration ID</dt>
                    <dd className={`font-mono font-medium ${p.registrationId ? "" : "text-warning"}`}>{p.registrationId || "Not set"}</dd>
                  </div>
                  <div>
                    <dt className="label-en">Serial</dt>
                    <dd className="truncate font-mono text-xs leading-5">{p.serialNumber || "—"}</dd>
                  </div>
                  <div>
                    <dt className="label-en">Total flight time</dt>
                    <dd className="text-xl font-semibold tnum">{formatHoursMinutes(total)}</dd>
                  </div>
                  <div>
                    <dt className="label-en">Flights</dt>
                    <dd className="text-xl font-semibold tnum">{own.length}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex gap-3 border-t pt-3 text-sm">
                  <Link href={`/log?aircraft=${p.id}`} className="font-medium text-primary hover:underline">
                    Journey log →
                  </Link>
                  <Link href={`/flights?aircraft=${p.id}`} className="text-muted-foreground hover:text-foreground">
                    Flights
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
