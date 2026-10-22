import { describe, expect, it } from "vitest";
import { fitZoom, project } from "./static-track-map";

describe("project", () => {
  it("maps lng/lat to Web-Mercator pixels", () => {
    expect(project(0, 0, 0)).toEqual([128, 128]);
    const [x, y] = project(139.767, 35.681, 10);
    expect(Math.floor(x / 256)).toBe(909); // Tokyo tile x at z10
    expect(Math.floor(y / 256)).toBe(403); // Tokyo tile y at z10
  });
});

describe("fitZoom", () => {
  it("zooms in on a short hop and out on a long flight", () => {
    const short: [number, number][] = [[139.767, 35.681], [139.768, 35.682]];
    const long: [number, number][] = [[46.658, -25.026], [46.55, -24.98]];
    expect(fitZoom(short, 760, 420)).toBeGreaterThan(fitZoom(long, 760, 420));
    expect(fitZoom(long, 760, 420)).toBeGreaterThanOrEqual(11);
  });

  it("caps a single point at zoom 16", () => {
    expect(fitZoom([[139.767, 35.681]], 760, 420)).toBe(16);
  });
});
