import { ArrowLeft, BatteryMedium, CloudSun, Gauge, MoveUpRight, Mountain, Route, TriangleAlert, Wind } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SignedBadge } from "@/components/status";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasDjiApiKey } from "@/lib/dji/decode";
import { weatherLabel } from "@/lib/enrich/weather";
import { formatDurationLong, formatHoursMinutes, formatLogDate, formatLogTime, formatMeters } from "@/lib/flight/format";
import { ESTIMATED_TIMES_WARNING } from "@/lib/flight/extract";
import { suggestSpecificFlights } from "@/lib/flight/suggest";
import { getFlight, listAircraft, listPilots } from "@/lib/server/queries";
import { requireUser } from "@/lib/server/session";
import { FlightForm } from "./flight-form";
import { FlightReview } from "./flight-review";
import { ReprocessButton } from "./reprocess";
import { SignPanel } from "./sign-panel";

export const metadata: Metadata = { title: "Flight" };

function Field({ ja, en, value, mono = true }: { ja: string; en: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground" title={ja}>
        {en}
      </div>
      <div className={mono ? "text-[15px] font-semibold tnum" : "text-sm font-medium"}>{value}</div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[10px] border bg-card px-3 py-2.5">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <div className="label-en">{label}</div>
        <div className="text-sm font-semibold tnum">{value}</div>
      </div>
    </div>
  );
}

export default async function FlightPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser();
  const data = await getFlight(id);
  if (!data) notFound();
  const [planes, pilots] = await Promise.all([listAircraft(true), listPilots()]);

  const f = data.flight;
  const tz = f.timeZone;
  const isPilot = f.pilotId === me.id;
  const canEdit = isPilot || me.role === "admin";
  const takeoff = f.takeoffLat !== null && f.takeoffLng !== null ? { lat: f.takeoffLat, lng: f.takeoffLng } : null;
  const landing = f.landingLat !== null && f.landingLng !== null ? { lat: f.landingLat, lng: f.landingLng } : null;
  const estimated = f.warnings.some((w) => w.message === ESTIMATED_TIMES_WARNING);
  const realWarnings = f.warnings.filter((w) => w.message !== ESTIMATED_TIMES_WARNING);
  const suggested =
    takeoff && landing
      ? suggestSpecificFlights({
          takeoffAt: f.takeoffAt,
          landingAt: f.landingAt,
          takeoff,
          landing,
          maxHeight: f.maxHeight ?? 0,
          durationSec: f.durationSec,
          maxDistance: 0,
          maxSpeed: 0,
          totalDistance: 0,
          batteryStart: null,
          batteryEnd: null,
          warnings: [],
          track: [],
        })
      : [];
  const w = f.weather;
  const keyConfigured = hasDjiApiKey();

  return (
    // Phone: one column ordered map → times → entry → sign; desktop: two columns (wrappers use display:contents on phones).
    <div className={`flex flex-col gap-4 md:gap-6 ${!f.signedAt && isPilot ? "pb-20 md:pb-0" : ""}`}>
      <div className="space-y-2 md:space-y-3">
        <Link href="/flights" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Flights
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl leading-8 font-semibold tracking-tight tnum md:text-[28px] md:leading-9">
            {formatLogDate(f.takeoffAt, tz)}
            <span className="text-muted-foreground"> · {data.aircraft.registrationId || data.aircraft.name}</span>
          </h1>
          <SignedBadge signed={!!f.signedAt} />
          {f.source === "manual" && <span className="rounded-full border px-2 py-0.5 text-xs">Manual entry</span>}
        </div>
        <p className="text-sm text-muted-foreground">
          {f.takeoffPlace || "—"} · {tz}
          {f.logFileName && <span className="ml-2 hidden font-mono text-xs md:inline">{f.logFileName}</span>}
        </p>
      </div>

      {/* Key log fields ②⑦⑧⑨⑩ */}
      <Card className="order-2 py-4 lg:order-none">
        <CardContent className="grid grid-cols-3 gap-x-4 gap-y-3 lg:grid-cols-6 lg:gap-x-6">
          <Field ja="② 飛行年月日" en="Date" value={formatLogDate(f.takeoffAt, tz)} />
          <Field ja="⑦ 離陸時刻" en="Off time" value={formatLogTime(f.takeoffAt, tz)} />
          <Field ja="⑧ 着陸時刻" en="On time" value={formatLogTime(f.landingAt, tz)} />
          <Field ja="⑨ 飛行時間" en="Flight time" value={formatDurationLong(f.durationSec)} />
          <Field ja="⑩ 総飛行時間" en="Total" value={formatHoursMinutes(data.totalSec)} />
          <Field
            ja="③ 操縦者"
            en="Pilot"
            mono={false}
            value={
              <>
                {data.pilotName}
                {data.pilotLicense && <span className="block text-xs text-muted-foreground">{data.pilotLicense}</span>}
              </>
            }
          />
        </CardContent>
        {estimated && (
          <div className="mx-4 flex flex-col gap-2 rounded-lg bg-warning/10 px-3 py-2.5 text-xs text-warning sm:flex-row sm:items-center md:mx-6">
            <span className="flex flex-1 items-start gap-2">
              <TriangleAlert className="size-4 shrink-0" />
              {keyConfigured
                ? "Imported before the DJI key was set: times are estimated and there is no GPS track."
                : ESTIMATED_TIMES_WARNING}
            </span>
            {keyConfigured && canEdit && <ReprocessButton flightId={f.id} variant="default" />}
          </div>
        )}
      </Card>

      <div className="contents lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)] lg:gap-6">
        <div className="contents lg:block lg:min-w-0 lg:space-y-4">
          <div className="order-1 -mx-4 md:mx-0 lg:order-none">
            <FlightReview track={f.track} takeoff={takeoff} landing={landing} />
          </div>

          <div className="order-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:order-none xl:grid-cols-5">
            <Stat icon={Mountain} label="Max height" value={f.maxHeight !== null ? `${f.maxHeight.toFixed(0)} m` : "—"} />
            <Stat icon={MoveUpRight} label="Max distance" value={f.maxDistance ? formatMeters(f.maxDistance) : "—"} />
            <Stat icon={Gauge} label="Max speed" value={f.maxSpeed !== null ? `${f.maxSpeed.toFixed(1)} m/s` : "—"} />
            <Stat icon={Route} label="Distance flown" value={f.totalDistance ? formatMeters(f.totalDistance) : "—"} />
            <Stat
              icon={BatteryMedium}
              label="Battery"
              value={f.batteryStart !== null && f.batteryEnd !== null ? `${f.batteryStart}% → ${f.batteryEnd}%` : "—"}
            />
          </div>

          <Card className="order-8 lg:order-none">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <TriangleAlert className="size-4 text-warning" /> Aircraft warnings
              </CardTitle>
            </CardHeader>
            <CardContent>
              {realWarnings.length === 0 ? (
                <p className="text-sm text-muted-foreground">No warnings recorded during this flight.</p>
              ) : (
                <ol className="relative space-y-3 border-l pl-4">
                  {realWarnings.map((wn) => (
                    <li key={`${wn.at}-${wn.message}`} className="relative text-sm">
                      <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full border-2 border-background bg-warning" />
                      <span className="mr-2 font-mono text-xs text-muted-foreground">{formatLogTime(wn.at, tz)}</span>
                      {wn.message}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="contents lg:block lg:space-y-4">
          <Card className="order-3 lg:order-none">
            <CardContent>
              <FlightForm
                flightId={f.id}
                locked={!!f.signedAt || !canEdit}
                canReassignPilot={me.role === "admin"}
                aircraft={planes.map((a) => ({ id: a.id, name: a.name }))}
                pilots={pilots.map((p) => ({ id: p.id, name: p.name }))}
                suggested={suggested}
                initial={{
                  purpose: f.purpose,
                  specificFlights: f.specificFlights,
                  route: f.route,
                  takeoffPlace: f.takeoffPlace,
                  landingPlace: f.landingPlace,
                  safetyNotes: f.safetyNotes,
                  remarks: f.remarks,
                  aircraftId: f.aircraftId,
                  pilotId: f.pilotId,
                }}
              />
            </CardContent>
          </Card>

          <Card className="order-7 lg:order-none">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <CloudSun className="size-4 text-primary" /> Weather at takeoff
              </CardTitle>
            </CardHeader>
            <CardContent>
              {w ? (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="label-en">Conditions</div>
                    <div className="font-semibold">{weatherLabel(w.weatherCode)?.en ?? "—"}</div>
                  </div>
                  <div>
                    <div className="label-en">Temp</div>
                    <div className="font-semibold tnum">{w.temperatureC !== null ? `${w.temperatureC.toFixed(1)} °C` : "—"}</div>
                  </div>
                  <div>
                    <div className="label-en">Wind</div>
                    <div className="flex items-center gap-1 font-semibold tnum">
                      {w.windDirectionDeg !== null && (
                        <Wind className="size-3.5" style={{ transform: `rotate(${w.windDirectionDeg + 90}deg)` }} aria-hidden />
                      )}
                      {w.windSpeedMs !== null ? `${w.windSpeedMs.toFixed(1)} m/s` : "—"}
                      {w.windGustMs !== null && <span className="font-normal text-muted-foreground">(↑{w.windGustMs.toFixed(1)})</span>}
                    </div>
                  </div>
                  <div>
                    <div className="label-en">Rain</div>
                    <div className="font-semibold tnum">{w.precipitationMm !== null ? `${w.precipitationMm} mm/h` : "—"}</div>
                  </div>
                  <p className="col-span-2 text-xs text-muted-foreground">Estimated · Open-Meteo hourly data at the takeoff point</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Weather unavailable for this flight.</p>
              )}
            </CardContent>
          </Card>

          <Card className="order-4 lg:sticky lg:top-6 lg:order-none">
            <CardContent>
              <SignPanel
                flightId={f.id}
                signedAt={f.signedAt ? f.signedAt.toISOString() : null}
                isPilot={isPilot}
                canEdit={canEdit}
                pilotName={data.pilotName}
                signature={data.pilotSignature}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
