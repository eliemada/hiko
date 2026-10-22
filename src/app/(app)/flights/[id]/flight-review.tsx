"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { AltitudeChart } from "@/components/altitude-chart";
import { Skeleton } from "@/components/ui/skeleton";
import type { TrackPoint } from "@/lib/flight/types";

const FlightMap = dynamic(() => import("@/components/flight-map").then((m) => m.FlightMap), {
  ssr: false,
  loading: () => <Skeleton className="h-[360px] w-full rounded-xl" />,
});

interface Props {
  track: TrackPoint[];
  takeoff: { lat: number; lng: number } | null;
  landing: { lat: number; lng: number } | null;
}

/** Map + altitude profile; hovering the chart moves a marker along the track. */
export function FlightReview({ track, takeoff, landing }: Props) {
  const [cursor, setCursor] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      <FlightMap
        track={track}
        takeoff={takeoff}
        landing={landing}
        cursor={cursor}
        className="h-[300px] rounded-none border-x-0 md:h-[360px] md:rounded-xl md:border-x lg:h-[420px]"
      />
      <div className="mx-4 rounded-xl border bg-card px-2 pt-3 pb-1 md:mx-0">
        <div className="mb-1 flex items-baseline justify-between px-2">
          <span className="text-sm font-medium">Altitude profile</span>
          <span className="label-en">Height above takeoff</span>
        </div>
        <AltitudeChart track={track} onHover={setCursor} />
      </div>
    </div>
  );
}
