import { describe, expect, it, vi } from "vitest";
import { IMAGERY_FALLBACK_ZOOM, maxImageryZoom, tileXY } from "./imagery";

const json = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;

describe("tileXY", () => {
  it("matches the tile numbers Esri uses", () => {
    expect(tileXY(46.658, -25.0257, 17)).toEqual({ x: 82523, y: 74951 }); // Tôlanaro, Madagascar
    expect(tileXY(0, 0, 1)).toEqual({ x: 1, y: 1 });
  });
});

describe("maxImageryZoom", () => {
  it("walks down until a level has real imagery", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const z = Number(url.split("/tilemap/")[1].split("/")[0]);
      return json({ data: [z <= 17 ? 1 : 0] });
    });
    expect(await maxImageryZoom(-25.03, 46.66, fetchImpl as unknown as typeof fetch)).toBe(17);
    expect(fetchImpl).toHaveBeenCalledTimes(3); // 19, 18, 17
  });

  it("caches per area", async () => {
    const fetchImpl = vi.fn(async () => json({ data: [1] }));
    await maxImageryZoom(35.68, 139.77, fetchImpl as unknown as typeof fetch);
    await maxImageryZoom(35.681, 139.771, fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("falls back to a safe zoom when the service is down", async () => {
    const fetchImpl = vi.fn(async () => json({}, false));
    expect(await maxImageryZoom(10, 10, fetchImpl as unknown as typeof fetch)).toBe(IMAGERY_FALLBACK_ZOOM);
  });
});
