type Fetch = typeof fetch;

const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "Hiko-UAS-Journey-Log/1.0 (self-hosted flight log)";
/** Nominatim's usage policy allows at most one request per second. */
const MIN_INTERVAL_MS = 1_100;

interface NominatimAddress {
  country_code?: string;
  province?: string;
  state?: string;
  city?: string;
  town?: string;
  village?: string;
  county?: string;
  city_district?: string;
  suburb?: string;
  quarter?: string;
  neighbourhood?: string;
  road?: string;
}

interface NominatimResponse {
  display_name?: string;
  address?: NominatimAddress;
}

/** "東京都千代田区丸の内" for Japan, "Lausanne, Vaud, Switzerland" elsewhere. */
export function formatAddress(res: NominatimResponse): string | null {
  const a = res.address;
  if (!a) return res.display_name ?? null;
  if (a.country_code === "jp") {
    const parts = [
      a.province ?? a.state,
      a.city ?? a.town ?? a.village ?? a.county,
      a.city_district,
      a.suburb ?? a.quarter,
      a.neighbourhood,
    ].filter((p): p is string => Boolean(p));
    const unique = parts.filter((p, i) => parts.indexOf(p) === i);
    if (unique.length > 0) return unique.join("");
  }
  const name = res.display_name?.split(",").map((p) => p.trim());
  return name ? name.slice(0, 3).join(", ") : null;
}

export function coordLabel(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

const cache = new Map<string, string>();
let lastCall = 0;

async function throttle() {
  const wait = lastCall + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
}

/** Reverse-geocode a point; falls back to raw coordinates when the service is unavailable. */
export async function reverseGeocode(
  lat: number,
  lng: number,
  fetchImpl: Fetch = fetch,
): Promise<string> {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const url = new URL(NOMINATIM);
  url.search = new URLSearchParams({
    format: "jsonv2",
    lat: String(lat),
    lon: String(lng),
    zoom: "17",
    "accept-language": "ja,en",
  }).toString();

  try {
    await throttle();
    const res = await fetchImpl(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const label = formatAddress((await res.json()) as NominatimResponse) ?? coordLabel(lat, lng);
    cache.set(key, label);
    return label;
  } catch (error) {
    console.warn("[geocode] reverse geocoding failed", { lat, lng, error: String(error) });
    return coordLabel(lat, lng);
  }
}
