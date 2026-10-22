import type { Metadata } from "next";
import { PageHeader } from "@/components/bilingual";
import { listAircraft, listPilots } from "@/lib/server/queries";
import { requireUser } from "@/lib/server/session";
import { ManualFlightForm } from "./manual-form";

export const metadata: Metadata = { title: "Manual entry" };

export default async function NewFlightPage() {
  const me = await requireUser();
  const [planes, pilots] = await Promise.all([listAircraft(), listPilots()]);
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Manual entry"
        description="For flights without a DJI log (another app, a lost controller…). Times are local to the selected time zone."
      />
      <ManualFlightForm
        me={me.id}
        isAdmin={me.role === "admin"}
        aircraft={planes.map((a) => ({ id: a.id, name: a.name }))}
        pilots={pilots.map((p) => ({ id: p.id, name: p.name }))}
      />
    </div>
  );
}
