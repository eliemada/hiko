"use client";

import { useEffect, useRef, useState } from "react";
import type { TrackPoint } from "@/lib/flight/types";
import { IMAGERY_MAX_ZOOM, maxImageryZoom } from "@/lib/imagery";

const TILE = 256;
const MAX_ZOOM = 18;
const PADDING = 40;
const TILE_URL = (z: number, x: number, y: number) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

/** Web-Mercator world pixel coordinates at zoom `z`. */
export function project(lng: number, lat: number, z: number): [number, number] {
  const scale = TILE * 2 ** z;
  const sin = Math.sin((Math.max(-85.0511, Math.min(85.0511, lat)) * Math.PI) / 180);
  return [((lng + 180) / 360) * scale, (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale];
}

/** Highest zoom at which all points fit inside width×height minus padding. */
export function fitZoom(points: [number, number][], width: number, height: number): number {
  for (let z = MAX_ZOOM; z > 1; z--) {
    const px = points.map(([lng, lat]) => project(lng, lat, z));
    const w = Math.max(...px.map((p) => p[0])) - Math.min(...px.map((p) => p[0]));
    const h = Math.max(...px.map((p) => p[1])) - Math.min(...px.map((p) => p[1]));
    if (w <= width - 2 * PADDING && h <= height - 2 * PADDING) return Math.min(z, points.length > 1 ? MAX_ZOOM : 16);
  }
  return 2;
}

interface Props {
  track: readonly TrackPoint[];
  takeoff: { lat: number; lng: number } | null;
  landing: { lat: number; lng: number } | null;
  cursor?: number | null;
}

/**
 * 2D fallback for browsers without WebGL2: satellite tiles as plain images
 * with the track drawn in SVG. No zoom/pan, but always renders.
 */
export function StaticTrackMap({ track, takeoff, landing, cursor }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  // null until Esri reports how deep real imagery goes here — avoids flashing placeholder tiles.
  const [imageryZoom, setImageryZoom] = useState<number | null>(null);

  const anchor = takeoff ?? (track[0] ? { lng: track[0][0], lat: track[0][1] } : null);
  useEffect(() => {
    if (!anchor) return;
    let alive = true;
    void maxImageryZoom(anchor.lat, anchor.lng).then((z) => alive && setImageryZoom(z));
    return () => {
      alive = false;
    };
  }, [anchor?.lat, anchor?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const points: [number, number][] = track.length
    ? track.map(([lng, lat]) => [lng, lat])
    : [takeoff, landing].filter((p): p is { lat: number; lng: number } => !!p).map((p) => [p.lng, p.lat]);

  let content: React.ReactNode = null;
  const ready = imageryZoom !== null || !anchor;
  if (size && size.w > 0 && points.length > 0 && ready) {
    const z = fitZoom(points, size.w, size.h);
    const px = points.map(([lng, lat]) => project(lng, lat, z));
    const cx = (Math.min(...px.map((p) => p[0])) + Math.max(...px.map((p) => p[0]))) / 2;
    const cy = (Math.min(...px.map((p) => p[1])) + Math.max(...px.map((p) => p[1]))) / 2;
    const left = cx - size.w / 2;
    const top = cy - size.h / 2;
    const toScreen = (lng: number, lat: number) => {
      const [x, y] = project(lng, lat, z);
      return [x - left, y - top] as const;
    };

    // Imagery may stop short of the zoom the track needs (rural areas):
    // fetch the deepest real level and scale its tiles up instead of showing placeholders.
    const zImg = Math.min(z, imageryZoom ?? IMAGERY_MAX_ZOOM);
    const scale = 2 ** (z - zImg);
    const tileSize = TILE * scale;
    const tiles: { x: number; y: number; key: string }[] = [];
    const n = 2 ** zImg;
    for (let tx = Math.floor(left / tileSize); tx <= Math.floor((left + size.w) / tileSize); tx++) {
      for (let ty = Math.floor(top / tileSize); ty <= Math.floor((top + size.h) / tileSize); ty++) {
        if (ty < 0 || ty >= n) continue;
        tiles.push({ x: tx, y: ty, key: `${zImg}/${tx}/${ty}` });
      }
    }

    const line = track.map(([lng, lat]) => toScreen(lng, lat).join(",")).join(" ");
    const start = takeoff ? toScreen(takeoff.lng, takeoff.lat) : null;
    const end = landing ? toScreen(landing.lng, landing.lat) : null;
    const cur = cursor != null && track[cursor] ? toScreen(track[cursor][0], track[cursor][1]) : null;

    content = (
      <>
        {tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={t.key}
            src={TILE_URL(zImg, ((t.x % n) + n) % n, t.y)}
            alt=""
            draggable={false}
            className="absolute max-w-none select-none"
            style={{ left: t.x * tileSize - left, top: t.y * tileSize - top, width: tileSize, height: tileSize }}
          />
        ))}
        <svg className="absolute inset-0 size-full" aria-hidden>
          <defs>
            <linearGradient id="track-grad" x1="0" x2="1">
              <stop offset="0%" stopColor="var(--takeoff)" />
              <stop offset="50%" stopColor="var(--track)" />
              <stop offset="100%" stopColor="var(--landing)" />
            </linearGradient>
          </defs>
          {track.length > 1 && (
            <>
              <polyline points={line} fill="none" stroke="black" strokeOpacity={0.35} strokeWidth={7} strokeLinejoin="round" />
              <polyline points={line} fill="none" stroke="var(--track)" strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" />
            </>
          )}
          {end && (!start || end[0] !== start[0] || end[1] !== start[1]) && <Pin at={end} label="L" color="var(--landing)" />}
          {start && <Pin at={start} label="H" color="var(--takeoff)" />}
          {cur && <circle cx={cur[0]} cy={cur[1]} r={6} fill="var(--track)" stroke="white" strokeWidth={2} />}
        </svg>
      </>
    );
  }

  return (
    <div ref={box} className="absolute inset-0 overflow-hidden">
      {content}
    </div>
  );
}

function Pin({ at, label, color }: { at: readonly [number, number]; label: string; color: string }) {
  return (
    <g transform={`translate(${at[0]} ${at[1]})`}>
      <circle r={13} fill={color} stroke="white" strokeWidth={2.5} />
      <text textAnchor="middle" dy="4" fontSize="11" fontWeight="700" fill="white">
        {label}
      </text>
    </g>
  );
}

/** True when the browser can create a WebGL2 context (required by MapLibre v5+). */
export function supportsWebGL2(): boolean {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}
