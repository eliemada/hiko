/** 特定飛行 categories (航空法 第132条の85〜86). */
export const SPECIFIC_FLIGHT_KINDS = [
  "airport",
  "above150m",
  "did",
  "night",
  "bvlos",
  "within30m",
  "event",
  "dangerousGoods",
  "dropping",
  "over25kg",
] as const;
export type SpecificFlightKind = (typeof SPECIFIC_FLIGHT_KINDS)[number];
