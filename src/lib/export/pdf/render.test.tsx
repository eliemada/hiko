import { writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderJournalPdf } from "./render";
import type { PdfJournalInput } from "./journal-document";

const T0 = Date.UTC(2026, 9, 18, 1, 12);
const sig =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function input(n: number): PdfJournalInput {
  return {
    aircraft: { label: "SAMPLE-ID（DJI Mavic 4 Pro S/N FICTIONAL-001)", registrationId: "SAMPLE-ID", model: "DJI Mavic 4 Pro", serialNumber: "FICTIONAL-001", name: "Mavic 4 Pro" },
    pilots: [
      { id: "p1", name: "Sample Pilot", licenseNumber: "SAMPLE-LICENSE" },
      { id: "p2", name: "山田 太郎", licenseNumber: null },
    ],
    signatures: { p1: sig, p2: null },
    initialSeconds: 3600 * 12,
    generatedAt: new Date(Date.UTC(2026, 9, 21)),
    squawks: [{ occurredOn: "2026-10-19", description: "プロペラ先端の欠け Propeller tip chipped", actionOn: "2026-10-20", action: "プロペラ交換、試験飛行で異常なし Replaced, test flight OK", confirmer: "Sample Pilot" }],
    flights: Array.from({ length: n }, (_, i) => ({
      id: `f${i}`,
      pilotId: i % 3 === 2 ? "p2" : "p1",
      takeoffAt: T0 + i * 86_400_000,
      landingAt: T0 + i * 86_400_000 + 1_260_000,
      durationSec: 1260,
      totalSec: 3600 * 12 + 1260 * (i + 1),
      timeZone: "Asia/Tokyo",
      pilotName: i % 3 === 2 ? "山田 太郎" : "Sample Pilot",
      pilotLicense: i % 3 === 2 ? null : "SAMPLE-LICENSE",
      purpose: i % 2 ? "空撮 (Aerial photography)" : "訓練 (Training)",
      specificFlights: i === 1 ? ["did", "night"] : [],
      route: "",
      takeoffPlace: "東京都江東区青海二丁目",
      landingPlace: "東京都江東区青海二丁目",
      safetyNotes: "天候 Weather: 晴れ Clear 18.2°C 風速 Wind 3.1 m/s（最大 gust 5.4）降水 Rain 0 mm\n特になし None",
      signedAt: i < n - 2 ? new Date() : null,
    })),
  };
}

describe("renderJournalPdf", () => {
  it("renders a cover plus one sheet per 15 flights", async () => {
    const buf = await renderJournalPdf(input(17));
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    const pages = buf.toString("latin1").match(/\/Type \/Page\b/g)?.length;
    expect(pages).toBe(3);
    if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT, buf);
  }, 60_000);
});
