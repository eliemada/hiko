import { ChevronRight, CircleAlert, PenLine, Upload, Wrench } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/bilingual";
import { SignedBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { formatDurationLong, formatHoursMinutes, formatLogDate, formatLogTime } from "@/lib/flight/format";
import { dashboardData } from "@/lib/server/queries";
import { requireUser } from "@/lib/server/session";
import { cn } from "@/lib/utils";
import { ActivityChart } from "./activity-chart";

export const metadata: Metadata = { title: "Overview" };

function Stat({ label, value, hint, href }: { label: string; value: string; hint?: string; href: string }) {
  return (
    <Link href={href} className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 active:bg-accent md:p-5">
      <div className="truncate text-[13px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight tnum md:text-3xl">{value}</div>
      {hint && <div className="mt-0.5 truncate text-xs text-muted-foreground tnum">{hint}</div>}
    </Link>
  );
}

function AttentionRow({
  href,
  icon: Icon,
  tone,
  title,
  detail,
}: {
  href: string;
  icon: React.ElementType;
  tone: "warning" | "destructive";
  title: string;
  detail: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3.5 active:bg-accent md:hover:bg-accent/50">
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full",
          tone === "warning" ? "bg-warning/12 text-warning" : "bg-destructive/10 text-destructive",
        )}
      >
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
    </Link>
  );
}

export default async function DashboardPage() {
  const me = await requireUser();
  const d = await dashboardData(me.id);
  const unregistered = d.perAircraft.filter((a) => !a.registrationId);
  const hasActivity = d.daily.some((x) => x.minutes > 0);
  const attention = d.myUnsigned > 0 || d.openSquawks > 0 || unregistered.length > 0;

  return (
    <div className="space-y-6 md:space-y-8">
      <PageHeader
        title="Overview"
        actions={
          <Button asChild className="hidden md:inline-flex">
            <Link href="/import">
              <Upload /> Import logs
            </Link>
          </Button>
        }
      />

      {d.totalFlights === 0 ? (
        <div className="grid place-items-center gap-3 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
          <p className="text-lg font-semibold">Import your first flight</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Copy the <code className="font-mono">FlightRecord</code> files off your DJI remote and drop them in — Hikō
            helps prepare your flight records in MLIT Form 1 format.
          </p>
          <Button asChild size="lg">
            <Link href="/import">
              <Upload /> Import flight records
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {attention && (
            <section aria-label="Needs attention" className="divide-y overflow-hidden rounded-xl border bg-card">
              {d.myUnsigned > 0 && (
                <AttentionRow
                  href="/flights?pilot=me&unsigned=1"
                  icon={PenLine}
                  tone="warning"
                  title={`${d.myUnsigned} flight${d.myUnsigned > 1 ? "s" : ""} to sign`}
                  detail="Check the purpose, then sign"
                />
              )}
              {d.openSquawks > 0 && (
                <AttentionRow
                  href="/squawks"
                  icon={Wrench}
                  tone="destructive"
                  title={`${d.openSquawks} open squawk${d.openSquawks > 1 ? "s" : ""}`}
                  detail="Record the corrective action"
                />
              )}
              {unregistered.map((a) => (
                <AttentionRow
                  key={a.id}
                  href="/aircraft"
                  icon={CircleAlert}
                  tone="warning"
                  title={`${a.name} has no registration ID`}
                  detail="Add the JU… number printed on the official log"
                />
              ))}
            </section>
          )}

          <div className="grid grid-cols-2 gap-2.5 md:gap-3 lg:grid-cols-4">
            <Stat
              label="Total flight time"
              value={formatHoursMinutes(d.totalSec)}
              hint={`${d.totalFlights} flight${d.totalFlights === 1 ? "" : "s"}`}
              href="/flights"
            />
            <Stat
              label="This month"
              value={formatHoursMinutes(d.monthSec)}
              hint={`${d.monthFlights} flight${d.monthFlights === 1 ? "" : "s"}`}
              href="/flights"
            />
            {d.perAircraft.slice(0, 2).map((a) => (
              <Stat
                key={a.id}
                label={a.name}
                value={formatHoursMinutes(a.totalSec)}
                hint={a.registrationId || "No registration ID"}
                href={`/log?aircraft=${a.id}`}
              />
            ))}
          </div>

          {hasActivity && (
            <section className="rounded-xl border bg-card p-4 md:p-5">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-medium">Airtime</h2>
                <span className="label-en">Last 12 weeks</span>
              </div>
              <ActivityChart data={d.daily} />
            </section>
          )}

          <section>
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 className="text-sm font-medium">Recent flights</h2>
              <Link href="/flights" className="text-sm text-primary">
                See all
              </Link>
            </div>
            <ul className="divide-y overflow-hidden rounded-xl border bg-card">
              {d.recent.map((f) => (
                <li key={f.id}>
                  <Link
                    href={`/flights/${f.id}`}
                    className="flex items-center gap-3 px-4 py-3 active:bg-accent md:hover:bg-accent/50"
                  >
                    <div className="w-[72px] shrink-0 text-sm font-medium tnum">
                      {formatLogDate(f.takeoffAt, f.timeZone).slice(5)}
                      <div className="text-xs font-normal text-muted-foreground">{formatLogTime(f.takeoffAt, f.timeZone)}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{f.takeoffPlace || "—"}</div>
                      <div className="truncate text-xs text-muted-foreground tnum">
                        {formatDurationLong(f.durationSec)} · {f.registrationId || f.aircraftName}
                      </div>
                    </div>
                    <SignedBadge signed={!!f.signedAt} compact />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
