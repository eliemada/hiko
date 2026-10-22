import type { Metadata } from "next";
import { PageHeader } from "@/components/bilingual";
import { OpenBadge } from "@/components/status";
import { listAircraft, listSquawks } from "@/lib/server/queries";
import { requireUser } from "@/lib/server/session";
import { SquawkDialog } from "./squawk-dialog";

export const metadata: Metadata = { title: "Squawks" };

export default async function SquawksPage() {
  const me = await requireUser();
  const [rows, planes] = await Promise.all([listSquawks(), listAircraft()]);
  const aircraft = planes.map((p) => ({ id: p.id, name: p.name }));
  const sorted = [...rows].reverse();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Squawks & corrective actions"
        description="Defects and fixes, printed in the REPORT (記事) block of each journey-log sheet."
        actions={aircraft.length > 0 && <SquawkDialog aircraft={aircraft} />}
      />

      {sorted.length === 0 ? (
        <div className="grid place-items-center gap-2 rounded-[10px] border border-dashed bg-card py-14 text-center">
          <p className="font-medium">No squawks</p>
          <p className="text-sm text-muted-foreground">Nothing reported — log a defect here when you find one.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-muted/60 text-left">
              <tr className="[&>th]:px-3 [&>th]:py-2.5 [&>th]:text-xs [&>th]:font-medium [&>th]:text-muted-foreground">
                <th>Date</th>
                <th>Aircraft</th>
                <th>Squawk</th>
                <th>Corrective action</th>
                <th>Confirmer</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.map(({ squawk: s, aircraftName }) => (
                <tr key={s.id} className="align-top [&>td]:px-3 [&>td]:py-2.5">
                  <td className="whitespace-nowrap tnum">{s.occurredOn.replaceAll("-", "/")}</td>
                  <td className="whitespace-nowrap text-muted-foreground">{aircraftName}</td>
                  <td className="max-w-72">{s.description}</td>
                  <td className="max-w-72">
                    {s.action ?? "—"}
                    {s.actionOn && <div className="text-xs text-muted-foreground tnum">{s.actionOn.replaceAll("-", "/")}</div>}
                  </td>
                  <td>{s.confirmer ?? "—"}</td>
                  <td>
                    <OpenBadge open={!s.actionOn} />
                  </td>
                  <td className="text-right">
                    <SquawkDialog
                      aircraft={aircraft}
                      canDelete={s.reportedBy === me.id || me.role === "admin"}
                      squawk={{
                        id: s.id,
                        aircraftId: s.aircraftId,
                        occurredOn: s.occurredOn,
                        description: s.description,
                        actionOn: s.actionOn ?? "",
                        action: s.action ?? "",
                        confirmer: s.confirmer ?? "",
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
