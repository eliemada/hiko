"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";

const config = { minutes: { label: "Airtime", color: "var(--chart-1)" } } satisfies ChartConfig;

export function ActivityChart({ data }: { data: { day: string; minutes: number }[] }) {
  return (
    <ChartContainer config={config} className="aspect-auto h-44 w-full">
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          interval={13}
          tickFormatter={(d: string) => d.slice(5).replace("-", "/")}
          className="tnum"
        />
        <YAxis tickLine={false} axisLine={false} unit="m" width={48} allowDecimals={false} className="tnum" />
        <ChartTooltip
          cursor={{ fill: "var(--muted)" }}
          content={({ active, payload }) => {
            const p = payload?.[0]?.payload as { day: string; minutes: number } | undefined;
            if (!active || !p) return null;
            return (
              <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md tnum">
                <div className="font-medium">{p.day.replaceAll("-", "/")}</div>
                <div className="text-muted-foreground">{p.minutes} min</div>
              </div>
            );
          }}
        />
        <Bar dataKey="minutes" fill="var(--color-minutes)" radius={[3, 3, 0, 0]} maxBarSize={10} />
      </BarChart>
    </ChartContainer>
  );
}
