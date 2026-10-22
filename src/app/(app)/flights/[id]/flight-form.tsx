"use client";

import { Check, Loader2, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { updateFlight } from "@/app/actions/flights";
import { BiLabel } from "@/components/bilingual";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SPECIFIC_FLIGHT_KINDS, type SpecificFlightKind } from "@/lib/flight/kinds";
import { natureOfFlight, PURPOSES, purposeValue, SPECIFIC_FLIGHT_LABELS } from "@/lib/flight/suggest";
import { cn } from "@/lib/utils";
import type { FlightEdit } from "@/lib/validation";

const AUTOSAVE_MS = 500;

type SaveState = "idle" | "saving" | "saved" | "error";

interface Props {
  flightId: string;
  initial: FlightEdit;
  locked: boolean;
  canReassignPilot: boolean;
  aircraft: { id: string; name: string }[];
  pilots: { id: string; name: string }[];
  /** Kinds the importer inferred from telemetry. */
  suggested: SpecificFlightKind[];
}

export function FlightForm({ flightId, initial, locked, canReassignPilot, aircraft, pilots, suggested }: Props) {
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const set = <K extends keyof FlightEdit>(key: K, value: FlightEdit[K]) => {
    if (locked) return;
    const next = { ...values, [key]: value };
    setValues(next);
    setState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await updateFlight(flightId, next);
      setState(res.success ? "saved" : "error");
      setError(res.success ? null : res.error);
    }, AUTOSAVE_MS);
  };
  const toggleKind = (kind: SpecificFlightKind, on: boolean) =>
    set("specificFlights", on ? [...values.specificFlights, kind] : values.specificFlights.filter((k) => k !== kind));

  return (
    <fieldset disabled={locked} className="space-y-5">
      <div className="flex items-center justify-between">
        <legend className="text-base font-semibold">Log entry</legend>
        <SaveIndicator state={locked ? "locked" : state} />
      </div>
      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <BiLabel ja="③ 飛行させた者" en="Pilot" />
          <Select value={values.pilotId} onValueChange={(v) => set("pilotId", v)} disabled={locked || !canReassignPilot}>
            <SelectTrigger className="w-full">
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
        <div className="space-y-2">
          <BiLabel ja="① 機体" en="Aircraft" />
          <Select value={values.aircraftId} onValueChange={(v) => set("aircraftId", v)}>
            <SelectTrigger className="w-full">
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
      </div>

      <div className="space-y-2">
        <BiLabel ja="④ 飛行概要" en="Purpose of flight" htmlFor="purpose" />
        <Input
          id="purpose"
          list="purposes"
          value={values.purpose}
          placeholder="Training, aerial photography, inspection…"
          onChange={(e) => set("purpose", e.target.value)}
          className={cn(!values.purpose && !locked && "border-warning")}
        />
        <datalist id="purposes">
          {PURPOSES.map((p) => (
            <option key={p.en} value={purposeValue(p)} />
          ))}
        </datalist>
        <div className="flex flex-wrap gap-1.5">
          {PURPOSES.slice(0, 6).map((p) => {
            const v = purposeValue(p);
            return (
              <button
                key={p.en}
                type="button"
                onClick={() => set("purpose", v)}
                title={v}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                  values.purpose === v ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary hover:text-primary",
                )}
              >
                {p.en}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">Presets are saved in Japanese and English, e.g. “空撮 (Aerial photography)”.</p>
      </div>

      <div className="space-y-2">
        <BiLabel ja="特定飛行" en="Specific flight categories" />
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {SPECIFIC_FLIGHT_KINDS.map((kind) => {
            const checked = values.specificFlights.includes(kind);
            return (
              <label
                key={kind}
                className={cn(
                  "flex min-h-10 cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 text-sm transition-colors",
                  checked ? "border-primary/50 bg-accent" : "hover:bg-muted/60",
                )}
              >
                <Checkbox checked={checked} onCheckedChange={(on) => toggleKind(kind, on === true)} />
                <span className="flex-1 leading-tight">
                  <span className="block">{SPECIFIC_FLIGHT_LABELS[kind].en}</span>
                  <span className="block text-[11px] text-muted-foreground">{SPECIFIC_FLIGHT_LABELS[kind].ja}</span>
                </span>
                {suggested.includes(kind) && (
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">AUTO</span>
                )}
              </label>
            );
          })}
        </div>
        {values.specificFlights.length === 0 && (
          <p className="text-xs text-muted-foreground">None checked → not a specific flight (特定飛行なし).</p>
        )}
      </div>

      <div className="space-y-2">
        <BiLabel ja="経由地" en="Route / waypoints (optional)" htmlFor="route" />
        <Input id="route" value={values.route} onChange={(e) => set("route", e.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <BiLabel ja="⑤ 離陸場所" en="Takeoff place" htmlFor="from" />
          <Input id="from" value={values.takeoffPlace} onChange={(e) => set("takeoffPlace", e.target.value)} />
        </div>
        <div className="space-y-2">
          <BiLabel ja="⑥ 着陸場所" en="Landing place" htmlFor="to" />
          <Input id="to" value={values.landingPlace} onChange={(e) => set("landingPlace", e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <BiLabel ja="⑫ 安全に影響のあった事項" en="Matters affecting flight safety" htmlFor="safety" />
        <Textarea id="safety" rows={3} value={values.safetyNotes} onChange={(e) => set("safetyNotes", e.target.value)} />
      </div>

      <div className="space-y-2">
        <BiLabel ja="⑬ 記事" en="Remarks" htmlFor="remarks" />
        <Textarea id="remarks" rows={2} value={values.remarks} onChange={(e) => set("remarks", e.target.value)} />
      </div>

      <div className="rounded-md border border-dashed bg-muted/40 px-3 py-2">
        <div className="label-en mb-1">As printed on the official log</div>
        <p className="text-sm">{natureOfFlight(values.purpose, values.specificFlights, values.route) || "—"}</p>
      </div>
    </fieldset>
  );
}

function SaveIndicator({ state }: { state: SaveState | "locked" }) {
  const map = {
    idle: null,
    saving: (
      <>
        <Loader2 className="size-3.5 animate-spin" /> Saving
      </>
    ),
    saved: (
      <>
        <Check className="size-3.5 text-success" /> Saved
      </>
    ),
    error: <span className="text-destructive">Save failed</span>,
    locked: (
      <>
        <Lock className="size-3.5" /> Signed · locked
      </>
    ),
  } as const;
  const content = map[state];
  return content ? (
    <span aria-live="polite" className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      {content}
    </span>
  ) : null;
}
