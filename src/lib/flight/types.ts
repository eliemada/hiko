/** Subset of a dji-log-parser `Frame` that the extractor relies on. */
export interface FrameLike {
  custom: { dateTime: string };
  osd: {
    flyTime: number;
    latitude: number;
    longitude: number;
    height: number;
    altitude: number;
    xSpeed: number;
    ySpeed: number;
    zSpeed: number;
    isOnGround: boolean;
    isMotorOn: boolean;
    flightAction?: unknown;
  };
  home: { latitude: number; longitude: number };
  battery: { chargeLevel: number };
  app: { warn: string; tip: string };
}

/** [longitude, latitude, heightAGL (m), epoch ms] */
export type TrackPoint = readonly [number, number, number, number];

export interface FlightWarning {
  at: number;
  message: string;
}

export interface FlightSegment {
  takeoffAt: number;
  landingAt: number;
  durationSec: number;
  takeoff: { lat: number; lng: number };
  landing: { lat: number; lng: number };
  maxHeight: number;
  maxDistance: number;
  maxSpeed: number;
  totalDistance: number;
  batteryStart: number | null;
  batteryEnd: number | null;
  warnings: FlightWarning[];
  track: TrackPoint[];
}
