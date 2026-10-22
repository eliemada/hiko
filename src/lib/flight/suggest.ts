import type { SpecificFlightKind } from "./kinds";
import { isNight } from "./geo";
import type { FlightSegment } from "./types";

/** 150 m above ground is the MLIT threshold for 特定飛行. */
export const HEIGHT_LIMIT_M = 150;

/**
 * 特定飛行 kinds that can be inferred from telemetry. Everything else
 * (DID, BVLOS, events…) is the pilot's call and stays unchecked.
 */
export function suggestSpecificFlights(seg: FlightSegment): SpecificFlightKind[] {
  const kinds: SpecificFlightKind[] = [];
  if (seg.maxHeight >= HEIGHT_LIMIT_M) kinds.push("above150m");
  const nightAtTakeoff = isNight(seg.takeoffAt, seg.takeoff.lat, seg.takeoff.lng);
  const nightAtLanding = isNight(seg.landingAt, seg.landing.lat, seg.landing.lng);
  if (nightAtTakeoff || nightAtLanding) kinds.push("night");
  return kinds;
}

export const SPECIFIC_FLIGHT_LABELS: Record<SpecificFlightKind, { ja: string; en: string }> = {
  airport: { ja: "空港等周辺", en: "Near airport" },
  above150m: { ja: "150m以上", en: "Above 150 m" },
  did: { ja: "人口集中地区(DID)", en: "Densely inhabited district" },
  night: { ja: "夜間飛行", en: "Night" },
  bvlos: { ja: "目視外飛行", en: "BVLOS" },
  within30m: { ja: "人・物件30m未満", en: "< 30 m from people/property" },
  event: { ja: "催し場所上空", en: "Over event" },
  dangerousGoods: { ja: "危険物輸送", en: "Dangerous goods" },
  dropping: { ja: "物件投下", en: "Dropping objects" },
  over25kg: { ja: "25kg以上", en: "25 kg or more" },
};

/** ④ text: "空撮 [特定飛行: 夜間飛行・目視外飛行] 経由地: …". */
export function natureOfFlight(purpose: string, kinds: readonly SpecificFlightKind[], route: string): string {
  const parts = [purpose.trim()];
  if (kinds.length > 0) parts.push(`[特定飛行: ${kinds.map((k) => SPECIFIC_FLIGHT_LABELS[k].ja).join("・")}]`);
  if (route.trim()) parts.push(`経由地: ${route.trim()}`);
  return parts.filter(Boolean).join(" ");
}

/** ⑫ default (bilingual): weather plus any aircraft warnings recorded during the flight. */
export function defaultSafetyNotes(weather: string, warnings: readonly { message: string }[]): string {
  const lines = [weather ? `天候 Weather: ${weather}` : ""];
  if (warnings.length > 0) lines.push(`機体警告 Warnings: ${warnings.map((w) => w.message).join(" / ")}`);
  else lines.push("特になし None");
  return lines.filter(Boolean).join("\n");
}

/** Purpose presets; stored as "空撮 (Aerial photography)" so the export reads naturally in Japan. */
export const PURPOSES = [
  { en: "Training", ja: "訓練" },
  { en: "Aerial photography", ja: "空撮" },
  { en: "Inspection", ja: "点検" },
  { en: "Survey", ja: "測量" },
  { en: "Business", ja: "業務" },
  { en: "Recreation", ja: "趣味" },
  { en: "Test flight", ja: "試験飛行" },
  { en: "Research & development", ja: "研究開発" },
] as const;

export const purposeValue = (p: { en: string; ja: string }) => `${p.ja} (${p.en})`;
