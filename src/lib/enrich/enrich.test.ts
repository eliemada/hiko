import { describe, expect, it, vi } from "vitest";
import { coordLabel, formatAddress, reverseGeocode } from "./geocode";
import { fetchWeather, pickHour, weatherLabel, weatherSummary } from "./weather";

const jsonResponse = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;

describe("formatAddress", () => {
  it("builds a compact Japanese address", () => {
    expect(
      formatAddress({
        address: { country_code: "jp", province: "東京都", city: "千代田区", suburb: "丸の内", neighbourhood: "一丁目" },
      }),
    ).toBe("東京都千代田区丸の内一丁目");
  });

  it("deduplicates repeated components", () => {
    expect(formatAddress({ address: { country_code: "jp", state: "大阪府", city: "大阪市", city_district: "大阪市" } })).toBe(
      "大阪府大阪市",
    );
  });

  it("keeps the first three parts elsewhere", () => {
    expect(
      formatAddress({ display_name: "EPFL, Route Cantonale, Ecublens, Vaud, Switzerland", address: { country_code: "ch" } }),
    ).toBe("EPFL, Route Cantonale, Ecublens");
  });
});

describe("reverseGeocode", () => {
  it("returns the formatted address and caches it", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ address: { country_code: "jp", province: "京都府", city: "京都市" } }),
    );
    expect(await reverseGeocode(35.0116, 135.7681, fetchImpl as unknown as typeof fetch)).toBe("京都府京都市");
    expect(await reverseGeocode(35.0116, 135.7681, fetchImpl as unknown as typeof fetch)).toBe("京都府京都市");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falls back to coordinates on failure", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => jsonResponse({}, false));
    expect(await reverseGeocode(1.5, 2.5, fetchImpl as unknown as typeof fetch)).toBe(coordLabel(1.5, 2.5));
  });
});

const hourly = {
  time: ["2026-10-21T04:00", "2026-10-21T05:00", "2026-10-21T06:00"],
  temperature_2m: [17, 18.24, 19],
  precipitation: [0, 0, 0.4],
  wind_speed_10m: [2, 3.14, 4],
  wind_gusts_10m: [4, 5.4, 7],
  wind_direction_10m: [180, 190, 200],
  weather_code: [1, 1, 61],
};

describe("weather", () => {
  it("picks the hour closest to takeoff", () => {
    const w = pickHour(hourly, Date.UTC(2026, 9, 21, 5, 20));
    expect(w?.temperatureC).toBe(18.24);
    expect(w?.windSpeedMs).toBe(3.14);
  });

  it("returns null when no hour is close", () => {
    expect(pickHour(hourly, Date.UTC(2026, 9, 22, 5))).toBeNull();
  });

  it("summarises bilingually", () => {
    const w = pickHour(hourly, Date.UTC(2026, 9, 21, 5, 0));
    expect(weatherSummary(w)).toBe("晴れ Fair 18.2°C 風速 wind 3.1 m/s（最大 gust 5.4） 降水 rain 0 mm");
    expect(weatherSummary(null)).toBe("");
    expect(weatherLabel(61)).toEqual({ ja: "雨", en: "Rain" });
    expect(weatherLabel(95)).toEqual({ ja: "雷雨", en: "Thunderstorm" });
    expect(weatherLabel(null)).toBeNull();
  });

  it("fetches from Open-Meteo with m/s units", async () => {
    const fetchImpl = vi.fn(async (url: URL) => (url ? jsonResponse({ hourly }) : jsonResponse({}, false)));
    const w = await fetchWeather(35.68, 139.77, Date.UTC(2026, 9, 21, 6), fetchImpl as unknown as typeof fetch);
    expect(w?.weatherCode).toBe(61);
    const url = fetchImpl.mock.calls[0][0];
    expect(url.searchParams.get("wind_speed_unit")).toBe("ms");
  });

  it("returns null when the API fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => jsonResponse({}, false));
    expect(await fetchWeather(0, 0, 0, fetchImpl as unknown as typeof fetch)).toBeNull();
  });
});
