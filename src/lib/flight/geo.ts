const EARTH_RADIUS_M = 6_371_008.8;

const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** A coordinate is usable when it is finite, in range and not the GPS "null island" placeholder. */
export function isValidCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(Math.abs(lat) < 1e-6 && Math.abs(lng) < 1e-6)
  );
}

/**
 * Sun elevation in degrees (NOAA simplified algorithm, ±0.5° accuracy),
 * enough to decide whether a flight happened at night (日没後〜日出前).
 */
export function sunElevationDeg(epochMs: number, lat: number, lng: number): number {
  const jd = epochMs / 86_400_000 + 2_440_587.5;
  const t = (jd - 2_451_545.0) / 36_525;
  const l0 = (280.46646 + t * (36_000.76983 + t * 0.0003032)) % 360;
  const m = 357.52911 + t * (35_999.05029 - 0.0001537 * t);
  const c =
    Math.sin(toRad(m)) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(toRad(2 * m)) * (0.019993 - 0.000101 * t) +
    Math.sin(toRad(3 * m)) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const lambda = l0 + c - 0.00569 - 0.00478 * Math.sin(toRad(omega));
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(toRad(omega));
  const decl = Math.asin(Math.sin(toRad(eps)) * Math.sin(toRad(lambda)));

  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const y = Math.tan(toRad(eps / 2)) ** 2;
  const eqTimeMin =
    4 *
    (180 / Math.PI) *
    (y * Math.sin(2 * toRad(l0)) -
      2 * e * Math.sin(toRad(m)) +
      4 * e * y * Math.sin(toRad(m)) * Math.cos(2 * toRad(l0)) -
      0.5 * y * y * Math.sin(4 * toRad(l0)) -
      1.25 * e * e * Math.sin(2 * toRad(m)));

  const date = new Date(epochMs);
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const trueSolarMin = (((utcMinutes + eqTimeMin + 4 * lng) % 1440) + 1440) % 1440;
  const hourAngle = trueSolarMin / 4 - 180;

  const cosZenith =
    Math.sin(toRad(lat)) * Math.sin(decl) +
    Math.cos(toRad(lat)) * Math.cos(decl) * Math.cos(toRad(hourAngle));
  const zenith = Math.acos(Math.min(1, Math.max(-1, cosZenith)));
  return 90 - (zenith * 180) / Math.PI;
}

/** Japanese rules define night as sunset→sunrise; -0.833° accounts for refraction + solar disc. */
export function isNight(epochMs: number, lat: number, lng: number): boolean {
  return sunElevationDeg(epochMs, lat, lng) < -0.833;
}
