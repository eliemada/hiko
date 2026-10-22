import type { FlightWeather } from "../db/schema";

type Fetch = typeof fetch;

const ENDPOINT = "https://historical-forecast-api.open-meteo.com/v1/forecast";
const HOURLY = [
  "temperature_2m",
  "precipitation",
  "wind_speed_10m",
  "wind_gusts_10m",
  "wind_direction_10m",
  "weather_code",
] as const;

interface OpenMeteoHourly {
  time: string[];
  temperature_2m: (number | null)[];
  precipitation: (number | null)[];
  wind_speed_10m: (number | null)[];
  wind_gusts_10m: (number | null)[];
  wind_direction_10m: (number | null)[];
  weather_code: (number | null)[];
}

const utcDate = (t: number) => new Date(t).toISOString().slice(0, 10);

export function pickHour(hourly: OpenMeteoHourly, at: number): FlightWeather | null {
  if (!hourly.time?.length) return null;
  let best = 0;
  let bestDiff = Number.POSITIVE_INFINITY;
  hourly.time.forEach((iso, i) => {
    const diff = Math.abs(Date.parse(`${iso}Z`) - at);
    if (diff < bestDiff) {
      best = i;
      bestDiff = diff;
    }
  });
  if (bestDiff > 90 * 60_000) return null;
  return {
    temperatureC: hourly.temperature_2m[best] ?? null,
    windSpeedMs: hourly.wind_speed_10m[best] ?? null,
    windGustMs: hourly.wind_gusts_10m[best] ?? null,
    windDirectionDeg: hourly.wind_direction_10m[best] ?? null,
    precipitationMm: hourly.precipitation[best] ?? null,
    weatherCode: hourly.weather_code[best] ?? null,
  };
}

/** Hourly weather at the takeoff point (Open-Meteo, free, no key). */
export async function fetchWeather(
  lat: number,
  lng: number,
  at: number,
  fetchImpl: Fetch = fetch,
): Promise<FlightWeather | null> {
  const url = new URL(ENDPOINT);
  url.search = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    start_date: utcDate(at - 3_600_000),
    end_date: utcDate(at + 3_600_000),
    hourly: HOURLY.join(","),
    wind_speed_unit: "ms",
    timezone: "GMT",
  }).toString();
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const body = (await res.json()) as { hourly?: OpenMeteoHourly };
    return body.hourly ? pickHour(body.hourly, at) : null;
  } catch (error) {
    console.warn("[weather] lookup failed", { lat, lng, at, error: String(error) });
    return null;
  }
}

const WEATHER_LABELS: { max: number; ja: string; en: string }[] = [
  { max: 0, ja: "快晴", en: "Clear" },
  { max: 2, ja: "晴れ", en: "Fair" },
  { max: 3, ja: "曇り", en: "Overcast" },
  { max: 48, ja: "霧", en: "Fog" },
  { max: 57, ja: "霧雨", en: "Drizzle" },
  { max: 67, ja: "雨", en: "Rain" },
  { max: 77, ja: "雪", en: "Snow" },
  { max: 82, ja: "にわか雨", en: "Showers" },
  { max: 86, ja: "にわか雪", en: "Snow showers" },
  { max: Number.POSITIVE_INFINITY, ja: "雷雨", en: "Thunderstorm" },
];

/** WMO weather interpretation code → { ja, en } label. */
export function weatherLabel(code: number | null): { ja: string; en: string } | null {
  if (code === null) return null;
  const hit = WEATHER_LABELS.find((l) => code <= l.max);
  return hit ? { ja: hit.ja, en: hit.en } : null;
}

/**
 * One-line bilingual weather summary for ⑫, readable by a Japanese inspector and
 * a foreign pilot: "晴れ Fair 18.2°C 風速 wind 3.1 m/s（最大 gust 5.4）降水 rain 0 mm".
 */
export function weatherSummary(w: FlightWeather | null): string {
  if (!w) return "";
  const label = weatherLabel(w.weatherCode);
  const parts = [
    label ? `${label.ja} ${label.en}` : "",
    w.temperatureC !== null ? `${w.temperatureC.toFixed(1)}°C` : "",
    w.windSpeedMs !== null
      ? `風速 wind ${w.windSpeedMs.toFixed(1)} m/s${w.windGustMs !== null ? `（最大 gust ${w.windGustMs.toFixed(1)}）` : ""}`
      : "",
    w.precipitationMm !== null ? `降水 rain ${w.precipitationMm} mm` : "",
  ];
  return parts.filter(Boolean).join(" ");
}
