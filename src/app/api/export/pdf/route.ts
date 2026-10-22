import { inArray } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { renderJournalPdf } from "@/lib/export/pdf/render";
import { loadJournal } from "@/lib/server/journal";
import { getCurrentUser } from "@/lib/server/session";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 });

  const aircraftId = request.nextUrl.searchParams.get("aircraft");
  if (!aircraftId) return NextResponse.json({ success: false, error: "Missing aircraft" }, { status: 400 });

  const journal = await loadJournal(aircraftId);
  if (!journal) return NextResponse.json({ success: false, error: "Aircraft not found" }, { status: 404 });

  try {
    const pilotIds = [...new Set(journal.flights.map((f) => f.pilotId))];
    const pilots = pilotIds.length
      ? await db
          .select({ id: user.id, name: user.name, licenseNumber: user.licenseNumber, signature: user.signature })
          .from(user)
          .where(inArray(user.id, pilotIds))
      : [];

    const pdf = await renderJournalPdf({
      aircraft: {
        label: journal.label,
        registrationId: journal.aircraft.registrationId,
        model: journal.aircraft.model,
        serialNumber: journal.aircraft.serialNumber,
        name: journal.aircraft.name,
      },
      flights: journal.flights,
      squawks: journal.squawks,
      pilots: pilots.map(({ id, name, licenseNumber }) => ({ id, name, licenseNumber })),
      signatures: Object.fromEntries(pilots.map((p) => [p.id, p.signature])),
      initialSeconds: journal.aircraft.initialSeconds,
      generatedAt: new Date(),
    });

    const name = `flight-log-${(journal.aircraft.registrationId || journal.aircraft.name).replace(/[^\w-]+/g, "_")}.pdf`;
    const inline = request.nextUrl.searchParams.get("download") !== "1";
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[export] pdf failed", { aircraftId, error });
    return NextResponse.json({ success: false, error: "PDF export failed" }, { status: 500 });
  }
}
