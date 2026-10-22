"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { Layers } from "lucide-react";
import * as maplibregl from "maplibre-gl";
import type { LngLatBoundsLike, StyleSpecification } from "maplibre-gl";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { TrackPoint } from "@/lib/flight/types";
import { IMAGERY_TILE_URL, maxImageryZoom } from "@/lib/imagery";
import { StaticTrackMap, supportsWebGL2 } from "./static-track-map";

type Basemap = "map" | "satellite";

// Copied from node_modules by scripts/copy-maplibre-worker.mjs (postinstall).
maplibregl.setWorkerUrl("/vendor/maplibre-gl-worker.mjs");

const VECTOR_STYLE = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

/** Raster maxzoom = deepest real imagery here; MapLibre enlarges those tiles beyond it. */
function satelliteStyle(maxzoom: number): StyleSpecification {
  return {
    version: 8,
    sources: {
      imagery: {
        type: "raster",
        tiles: [IMAGERY_TILE_URL],
        tileSize: 256,
        maxzoom,
        attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
      },
    },
    layers: [{ id: "imagery", type: "raster", source: "imagery" }],
  };
}

/** Resolve a theme token to rgb() — MapLibre can't parse oklch()/lab(). */
function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!value || !ctx) return fallback;
  ctx.fillStyle = fallback;
  ctx.fillStyle = value;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

function pin(kind: "takeoff" | "landing") {
  const el = document.createElement("div");
  el.className = cn(
    "grid size-7 place-items-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-lg",
    kind === "takeoff" ? "bg-[var(--takeoff)]" : "bg-[var(--landing)]",
  );
  el.textContent = kind === "takeoff" ? "H" : "L";
  el.setAttribute("aria-label", kind === "takeoff" ? "Takeoff" : "Landing");
  return el;
}

interface Props {
  track: readonly TrackPoint[];
  takeoff: { lat: number; lng: number } | null;
  landing: { lat: number; lng: number } | null;
  /** Index into `track` to highlight (synced with the altitude chart). */
  cursor?: number | null;
  className?: string;
}

export function FlightMap({ track, takeoff, landing, cursor, className }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const cursorMarker = useRef<maplibregl.Marker | null>(null);
  const { resolvedTheme } = useTheme();
  const [basemap, setBasemap] = useState<Basemap>("satellite");
  // MapLibre needs WebGL2; without it (hardware acceleration off, old GPU…) use a flat 2D map.
  const [fallback, setFallback] = useState(() => !supportsWebGL2());
  const [imageryZoom, setImageryZoom] = useState<number | null>(null);

  const anchor = takeoff ?? (track[0] ? { lng: track[0][0], lat: track[0][1] } : null);
  useEffect(() => {
    if (!anchor || fallback) return;
    let alive = true;
    void maxImageryZoom(anchor.lat, anchor.lng).then((z) => alive && setImageryZoom(z));
    return () => {
      alive = false;
    };
  }, [anchor?.lat, anchor?.lng, fallback]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!container.current || fallback) return;
    // Wait for the imagery depth so the map never requests placeholder tiles.
    if (basemap === "satellite" && imageryZoom === null && anchor) return;
    const style =
      basemap === "satellite" ? satelliteStyle(imageryZoom ?? 19) : VECTOR_STYLE[resolvedTheme === "dark" ? "dark" : "light"];
    let instance: maplibregl.Map;
    try {
      instance = new maplibregl.Map({
        container: container.current,
        style,
        center: takeoff ? [takeoff.lng, takeoff.lat] : [139.767, 35.681],
        zoom: 15,
        pitch: 45,
        attributionControl: { compact: true },
      });
    } catch (error) {
      console.warn("[map] WebGL map unavailable, using 2D fallback", error);
      const t = setTimeout(() => setFallback(true));
      return () => clearTimeout(t);
    }
    map.current = instance;
    instance.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");

    instance.on("load", () => {
      const coords = track.map(([lng, lat]) => [lng, lat]);
      if (coords.length > 1) {
        instance.addSource("track", {
          type: "geojson",
          lineMetrics: true,
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } },
        });
        instance.addLayer({
          id: "track-casing",
          type: "line",
          source: "track",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#000", "line-opacity": 0.35, "line-width": 7, "line-blur": 2 },
        });
        instance.addLayer({
          id: "track",
          type: "line",
          source: "track",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-width": 4,
            "line-gradient": [
              "interpolate",
              ["linear"],
              ["line-progress"],
              0,
              cssVar("--takeoff", "#16a34a"),
              0.5,
              cssVar("--track", "#38bdf8"),
              1,
              cssVar("--landing", "#f97316"),
            ],
          },
        });
        const bounds = coords.reduce(
          (b, c) => b.extend(c as [number, number]),
          new maplibregl.LngLatBounds(coords[0] as [number, number], coords[0] as [number, number]),
        );
        instance.fitBounds(bounds as LngLatBoundsLike, { padding: 64, duration: 0, maxZoom: 18, pitch: 30 });
      }
      if (takeoff) new maplibregl.Marker({ element: pin("takeoff") }).setLngLat([takeoff.lng, takeoff.lat]).addTo(instance);
      if (landing && (!takeoff || takeoff.lat !== landing.lat || takeoff.lng !== landing.lng)) {
        new maplibregl.Marker({ element: pin("landing") }).setLngLat([landing.lng, landing.lat]).addTo(instance);
      }
    });

    return () => {
      cursorMarker.current = null;
      instance.remove();
      map.current = null;
    };
  }, [track, takeoff, landing, basemap, resolvedTheme, fallback, imageryZoom]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const point = cursor !== null && cursor !== undefined ? track[cursor] : undefined;
    if (!point) {
      cursorMarker.current?.remove();
      cursorMarker.current = null;
      return;
    }
    if (!cursorMarker.current) {
      const el = document.createElement("div");
      el.className = "size-3.5 rounded-full border-2 border-white bg-[var(--track)] shadow-[0_0_0_4px_rgb(56_189_248/0.35)]";
      cursorMarker.current = new maplibregl.Marker({ element: el });
    }
    cursorMarker.current.setLngLat([point[0], point[1]]).addTo(instance);
  }, [cursor, track]);

  if (fallback) {
    return (
      <div className={cn("relative overflow-hidden rounded-xl border bg-muted", className)}>
        <StaticTrackMap track={track} takeoff={takeoff} landing={landing} cursor={cursor} />
        <div className="absolute top-2 left-2 z-10 rounded-md bg-background/90 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
          2D map — turn on hardware acceleration for the 3D view
        </div>
        <div className="absolute right-1 bottom-1 z-10 rounded bg-background/80 px-1.5 text-[10px] text-muted-foreground">
          Imagery © Esri, Maxar, Earthstar Geographics
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-xl border bg-muted", className)}>
      <div ref={container} className="h-full w-full" />
      <button
        type="button"
        onClick={() => setBasemap((b) => (b === "map" ? "satellite" : "map"))}
        className="absolute top-2 left-2 z-10 inline-flex items-center gap-1.5 rounded-md border bg-background/90 px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur transition-colors hover:bg-background"
      >
        <Layers className="size-3.5" aria-hidden />
        {basemap === "map" ? "Satellite" : "Map"}
      </button>
      {track.length < 2 && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 mx-auto w-fit rounded-md bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
          No GPS track — only takeoff point available
        </div>
      )}
    </div>
  );
}
