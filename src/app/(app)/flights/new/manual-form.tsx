"use client";

import { ChevronDown, Loader2, LocateFixed, PlaneLanding, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { createManualFlight, prefillFromLocation } from "@/app/actions/flights";
import { BiLabel } from "@/components/bilingual";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SPECIFIC_FLIGHT_KINDS, type SpecificFlightKind } from "@/lib/flight/kinds";
import { justLanded, landingFor, localParts } from "@/lib/flight/manual-time";
import { PURPOSES, purposeValue, SPECIFIC_FLIGHT_LABELS } from "@/lib/flight/suggest";
import { cn } from "@/lib/utils";

interface Props {
  me: string;
  isAdmin: boolean;
  aircraft: { id: string; name: string }[];
  pilots: { id: string; name: string }[];
}

const DURATIONS = [5, 10, 15, 20, 30, 45];
const MEMORY_KEY = "hiko:manual-entry";

interface Memory {
  aircraftId?: string;
  purpose?: string;
  duration?: number;
}

function recall(): Memory {
  try {
    return JSON.parse(localStorage.getItem(MEMORY_KEY) ?? "{}") as Memory;
  } catch {
    return {};
  }
}

function remember(m: Memory) {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(m));
  } catch {
    /* private mode — not critical */
  }
}

const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** Field-friendly manual entry: one-tap "just landed", duration chips, GPS place + weather. */
export function ManualFlightForm({ me, isAdmin, aircraft, pilots }: Props) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [locating, setLocating] = useState(false);

  const [timeZone, setTimeZone] = useState(browserZone);
  const [aircraftId, setAircraftId] = useState(aircraft[0]?.id ?? "");
  const [pilotId, setPilotId] = useState(me);
  const [date, setDate] = useState(() => localParts(Date.now(), browserZone()).date);
  const [takeoffTime, setTakeoffTime] = useState("");
  const [duration, setDuration] = useState(15);
  const [customDuration, setCustomDuration] = useState(false);
  const [purpose, setPurpose] = useState("");
  const [place, setPlace] = useState("");
  const [sameLanding, setSameLanding] = useState(true);
  const [landingPlace, setLandingPlace] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [kinds, setKinds] = useState<SpecificFlightKind[]>([]);
  const [showKinds, setShowKinds] = useState(false);
  const [notes, setNotes] = useState("特になし None");

  // Restore last-used aircraft / purpose / duration (client only).
  useEffect(() => {
    const m = recall();
    const t = setTimeout(() => {
      if (m.aircraftId && aircraft.some((a) => a.id === m.aircraftId)) setAircraftId(m.aircraftId);
      if (m.purpose) setPurpose(m.purpose);
      if (m.duration) setDuration(m.duration);
    });
    return () => clearTimeout(t);
  }, [aircraft]);

  if (aircraft.length === 0) {
    return <p className="text-sm text-muted-foreground">Add an aircraft first (More → Aircraft).</p>;
  }

  const { landing, nextDay } = takeoffTime ? landingFor(takeoffTime, duration) : { landing: "", nextDay: false };

  const setJustLanded = () => {
    const t = justLanded(Date.now(), duration, timeZone);
    setDate(t.date);
    setTakeoffTime(t.takeoffTime);
  };

  const locate = () => {
    if (!window.isSecureContext) {
      return void toast.error("Your phone only shares location with HTTPS pages — open Hikō through its https:// address.");
    }
    if (!("geolocation" in navigator)) return void toast.error("Location isn't available on this device");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const at = takeoffTime ? new Date(`${date}T${takeoffTime}:00`).getTime() : Date.now();
        const res = await prefillFromLocation({ ...point, at });
        setLocating(false);
        if (!res.success || !res.data) return void toast.error(res.success ? "Lookup failed" : res.error);
        setCoords(point);
        setPlace(res.data.place);
        setTimeZone(res.data.timeZone);
        setNotes(res.data.safetyNotes);
        if (res.data.suggested.length) {
          setKinds((k) => [...new Set([...k, ...res.data!.suggested])]);
          setShowKinds(true);
        }
        toast.success("Place and weather filled in");
      },
      (err) => {
        setLocating(false);
        toast.error(err.code === err.PERMISSION_DENIED ? "Location permission denied" : "Couldn't get your location");
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  };

  const save = () => {
    if (!takeoffTime) return void toast.error("Set the takeoff time — or tap “Just landed”");
    if (!purpose.trim()) return void toast.error("Pick a purpose");
    if (!place.trim()) return void toast.error("Add the takeoff place — or tap “Use my location”");
    startSave(async () => {
      const res = await createManualFlight({
        aircraftId,
        pilotId,
        date,
        takeoffTime,
        landingTime: landing,
        timeZone,
        purpose,
        specificFlights: kinds,
        route: "",
        takeoffPlace: place,
        landingPlace: sameLanding ? place : landingPlace || place,
        safetyNotes: notes,
        remarks: "",
        ...(coords ? { takeoffLat: coords.lat, takeoffLng: coords.lng } : {}),
      });
      if (!res.success) return void toast.error(res.error);
      remember({ aircraftId, purpose, duration });
      toast.success("Flight added");
      router.push(`/flights/${res.data?.id}`);
    });
  };

  const chip = (active: boolean) =>
    cn(
      "h-10 rounded-full border px-4 text-sm font-medium transition-colors active:scale-[0.97]",
      active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/60",
    );

  return (
    <div className="space-y-4 pb-24 md:pb-0">
      {/* When */}
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">When</h2>
          <Button type="button" variant="secondary" size="sm" className="h-9" onClick={setJustLanded}>
            <PlaneLanding /> Just landed
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Date</span>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-12 text-base" />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Takeoff</span>
            <Input type="time" value={takeoffTime} onChange={(e) => setTakeoffTime(e.target.value)} className="h-12 text-base" />
          </label>
        </div>
        <div className="space-y-1.5">
          <span className="text-xs text-muted-foreground">Flight time</span>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setDuration(m);
                  setCustomDuration(false);
                }}
                className={chip(!customDuration && duration === m)}
              >
                {m} min
              </button>
            ))}
            <button type="button" onClick={() => setCustomDuration(true)} className={chip(customDuration)}>
              Other
            </button>
          </div>
          {customDuration && (
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={600}
              value={duration}
              onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))}
              className="mt-2 h-12 w-32 text-base"
              aria-label="Minutes"
            />
          )}
        </div>
      </section>

      {/* Where */}
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Where</h2>
          <Button type="button" variant="secondary" size="sm" className="h-9" onClick={locate} disabled={locating}>
            {locating ? <Loader2 className="animate-spin" /> : <LocateFixed />} {locating ? "Locating…" : "Use my location"}
          </Button>
        </div>
        <Input
          value={place}
          onChange={(e) => {
            setPlace(e.target.value);
            setCoords(null);
          }}
          placeholder="Takeoff place, e.g. 東京都江東区青海"
          className="h-12 text-base"
          aria-label="Takeoff place"
        />
        <label className="flex items-center justify-between gap-3 text-sm">
          Landed at the same place
          <Switch checked={sameLanding} onCheckedChange={setSameLanding} />
        </label>
        {!sameLanding && (
          <Input
            value={landingPlace}
            onChange={(e) => setLandingPlace(e.target.value)}
            placeholder="Landing place"
            className="h-12 text-base"
            aria-label="Landing place"
          />
        )}
        {timeZone !== browserZone() && <p className="text-xs text-muted-foreground">Times are in {timeZone}.</p>}
      </section>

      {/* What */}
      <section className="space-y-3 rounded-xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Purpose</h2>
        <div className="flex flex-wrap gap-2">
          {PURPOSES.slice(0, 6).map((p) => (
            <button key={p.en} type="button" onClick={() => setPurpose(purposeValue(p))} className={chip(purpose === purposeValue(p))}>
              {p.en}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setShowKinds((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg border px-3 py-3 text-left text-sm"
        >
          <span>
            Specific flight <span className="text-muted-foreground">特定飛行</span>
            <span className="block text-xs text-muted-foreground">
              {kinds.length ? kinds.map((k) => SPECIFIC_FLIGHT_LABELS[k].en).join(", ") : "None"}
            </span>
          </span>
          <ChevronDown className={cn("size-4 transition-transform", showKinds && "rotate-180")} />
        </button>
        {showKinds && (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {SPECIFIC_FLIGHT_KINDS.map((k) => (
              <label key={k} className="flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                <Checkbox
                  checked={kinds.includes(k)}
                  onCheckedChange={(on) => setKinds((all) => (on === true ? [...all, k] : all.filter((x) => x !== k)))}
                />
                <span className="leading-tight">
                  <span className="block">{SPECIFIC_FLIGHT_LABELS[k].en}</span>
                  <span className="block text-[11px] text-muted-foreground">{SPECIFIC_FLIGHT_LABELS[k].ja}</span>
                </span>
              </label>
            ))}
          </div>
        )}
        <div className="space-y-1.5">
          <BiLabel ja="⑫ 安全に影響のあった事項" en="Safety notes" htmlFor="notes" />
          <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="text-base" />
        </div>
      </section>

      {/* Aircraft & pilot only when there's a real choice */}
      {(aircraft.length > 1 || (isAdmin && pilots.length > 1)) && (
        <section className="grid grid-cols-1 gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2">
          {aircraft.length > 1 && (
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Aircraft</span>
              <Select value={aircraftId} onValueChange={setAircraftId}>
                <SelectTrigger className="h-12 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {aircraft.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {isAdmin && pilots.length > 1 && (
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground">Pilot</span>
              <Select value={pilotId} onValueChange={setPilotId}>
                <SelectTrigger className="h-12 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pilots.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </section>
      )}

      {/* Save — pinned above the tab bar on phones */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 border-t bg-background/92 px-4 py-2.5 backdrop-blur-xl md:static md:border-0 md:bg-transparent md:p-0">
        <div className="min-w-0 flex-1 text-sm tnum">
          {takeoffTime ? (
            <>
              <span className="font-semibold">
                {takeoffTime} → {landing}
                {nextDay && <span className="text-xs text-muted-foreground"> +1</span>}
              </span>
              <span className="text-muted-foreground"> · {duration} min</span>
            </>
          ) : (
            <span className="text-muted-foreground">Set the takeoff time</span>
          )}
        </div>
        <Button size="lg" className="h-12 px-6" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" /> : <Save />} Save
        </Button>
      </div>
    </div>
  );
}
