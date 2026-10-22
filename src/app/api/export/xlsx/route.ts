import { readFile } from "node:fs/promises";
import { inArray } from "drizzle-orm";
import path from "node:path";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { user as userTable } from "@/lib/db/schema";
import { buildJournalWorkbook } from "@/lib/export/xlsx";
import { loadJournal } from "@/lib/server/journal";
import { getCurrentUser } from "@/lib/server/session";

export const runtime = "nodejs";

const TEMPLATE = path.join(process.cwd(), "src/assets/journey-log-template.xlsx");

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 });

  const aircraftId = request.nextUrl.searchParams.get("aircraft");
  if (!aircraftId) return NextResponse.json({ success: false, error: "Missing aircraft" }, { status: 400 });

  const journal = await loadJournal(aircraftId);
  if (!journal) return NextResponse.json({ success: false, error: "Aircraft not found" }, { status: 404 });

  try {
    const pilotIds = [...new Set(journal.flights.map((f) => f.pilotId))];
    const signatures = pilotIds.length
      ? await db.select({ id: userTable.id, signature: userTable.signature }).from(userTable).where(inArray(userTable.id, pilotIds))
      : [];
    const buf = await buildJournalWorkbook(await readFile(TEMPLATE), {
      aircraftLabel: journal.label,
      flights: journal.flights,
      squawks: journal.squawks,
      signatures: Object.fromEntries(signatures.map((s) => [s.id, s.signature])),
    });
    const name = `journey-log-${(journal.aircraft.registrationId || journal.aircraft.name).replace(/[^\w-]+/g, "_")}.xlsx`;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[export] xlsx failed", { aircraftId, error });
    return NextResponse.json({ success: false, error: "Export failed" }, { status: 500 });
  }
}
