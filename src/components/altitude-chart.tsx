"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import type { TrackPoint } from "@/lib/flight/types";

const config = { height: { label: "Height AGL", color: "var(--track)" } } satisfies ChartConfig;

interface Props {
  track: readonly TrackPoint[];
  onHover?: (index: number | null) => void;
}

const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

export function AltitudeChart({ track, onHover }: Props) {
  if (track.length < 2) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No altitude profile for this flight.</p>;
  }
  const t0 = track[0][3];
  const data = track.map(([, , h, t], i) => ({ i, sec: (t - t0) / 1000, height: h }));

  return (
    <ChartContainer config={config} className="aspect-auto h-40 w-full">
      <AreaChart
        data={data}
        margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
        onMouseMove={(state) => {
          const idx = state?.activeTooltipIndex;
          onHover?.(typeof idx === "number" ? idx : idx != null ? Number(idx) : null);
        }}
        onMouseLeave={() => onHover?.(null)}
      >
        <defs>
          <linearGradient id="alt-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-height)" stopOpacity={0.45} />
            <stop offset="100%" stopColor="var(--color-height)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="sec"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={mmss}
          tickLine={false}
          axisLine={false}
          tickMargin={6}
          className="tabular-nums"
        />
        <YAxis dataKey="height" unit=" m" tickLine={false} axisLine={false} width={56} className="tabular-nums" />
        <ChartTooltip
          cursor={{ stroke: "var(--color-height)", strokeWidth: 1 }}
          content={({ active, payload }) => {
            const p = payload?.[0]?.payload as { sec: number; height: number } | undefined;
            if (!active || !p) return null;
            return (
              <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md tabular-nums">
                <div className="font-medium">{p.height.toFixed(1)} m AGL</div>
                <div className="text-muted-foreground">T+{mmss(p.sec)}</div>
              </div>
            );
          }}
        />
        <Area
          dataKey="height"
          type="monotone"
          stroke="var(--color-height)"
          strokeWidth={2}
          fill="url(#alt-fill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
