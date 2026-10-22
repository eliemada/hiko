/**
 * Esri World Imagery has detailed tiles in cities but often stops around zoom
 * 15–17 in rural areas, returning a grey "Map data not yet available" image
 * (HTTP 200) beyond that. Its tilemap service says which levels really exist,
 * so maps can stop there and enlarge the last real tiles instead.
 */
export const IMAGERY_TILE_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const TILEMAP_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tilemap";

export const IMAGERY_MAX_ZOOM = 19;
/** Lowest level we bother checking; global imagery always exists below it. */
const IMAGERY_MIN_CHECK = 10;
/** Used when the availability service can't be reached. */
export const IMAGERY_FALLBACK_ZOOM = 17;

export function tileXY(lng: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const clamped = Math.max(-85.0511, Math.min(85.0511, lat));
  const rad = (clamped * Math.PI) / 180;
  return {
    x: Math.min(n - 1, Math.max(0, Math.floor(((lng + 180) / 360) * n))),
    y: Math.min(n - 1, Math.max(0, Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n))),
  };
}

async function hasTile(lng: number, lat: number, z: number, fetchImpl: typeof fetch): Promise<boolean> {
  const { x, y } = tileXY(lng, lat, z);
  const res = await fetchImpl(`${TILEMAP_URL}/${z}/${y}/${x}/1/1?f=json`, { signal: AbortSignal.timeout(6_000) });
  if (!res.ok) throw new Error(`tilemap ${res.status}`);
  const body = (await res.json()) as { data?: number[] };
  return body.data?.[0] === 1;
}

const cache = new Map<string, Promise<number>>();

/** Highest zoom with real satellite imagery at this point (cached per ~1 km). */
export function maxImageryZoom(lat: number, lng: number, fetchImpl: typeof fetch = fetch): Promise<number> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const lookup = (async () => {
    try {
      for (let z = IMAGERY_MAX_ZOOM; z > IMAGERY_MIN_CHECK; z--) {
        if (await hasTile(lng, lat, z, fetchImpl)) return z;
      }
      return IMAGERY_MIN_CHECK;
    } catch {
      cache.delete(key);
      return IMAGERY_FALLBACK_ZOOM;
    }
  })();
  cache.set(key, lookup);
  return lookup;
}
