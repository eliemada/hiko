import { readFileSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { JournalFlight } from "./journal-rows";
import { toJournalRow } from "./journal-rows";
import { buildJournalWorkbook, LAYOUT } from "./xlsx";

const template = readFileSync(path.join(process.cwd(), "src/assets/journey-log-template.xlsx"));

const T0 = Date.UTC(2026, 9, 21, 5, 3); // 14:03 JST

function makeFlight(i: number): JournalFlight {
  return {
    takeoffAt: T0 + i * 86_400_000,
    landingAt: T0 + i * 86_400_000 + 754_000,
    durationSec: 754,
    totalSec: 754 * (i + 1),
    timeZone: "Asia/Tokyo",
    pilotName: "山田 太郎",
    pilotLicense: i === 0 ? "1-23-456" : null,
    purpose: "空撮",
    specificFlights: i === 0 ? ["night"] : [],
    route: "",
    takeoffPlace: "東京都千代田区丸の内",
    landingPlace: "東京都千代田区丸の内",
    safetyNotes: "天候: 晴れ\n特になし",
    signedAt: i === 0 ? new Date() : null,
  };
}

async function read(buf: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  return wb;
}

describe("toJournalRow", () => {
  it("formats an MLIT row", () => {
    expect(toJournalRow(makeFlight(0))).toEqual({
      date: "2026/10/21",
      pilot: "山田 太郎（1-23-456）",
      nature: "空撮 [特定飛行: 夜間飛行]",
      from: "東京都千代田区丸の内",
      to: "東京都千代田区丸の内",
      off: "14:03",
      on: "14:15",
      flightTime: "0:13",
      totalTime: "0:13",
      safety: "天候: 晴れ / 特になし",
      signed: true,
    });
  });
});

describe("buildJournalWorkbook", () => {
  it("fills the official template and keeps its headings", async () => {
    const buf = await buildJournalWorkbook(template, {
      aircraftLabel: "JU1234567890 / DJI Mavic 4 Pro",
      flights: [makeFlight(0)],
      squawks: [{ occurredOn: "2026-10-21", description: "プロペラ欠け", actionOn: "2026-10-22", action: "交換", confirmer: "山田" }],
    });
    const ws = (await read(buf)).worksheets[0];
    expect(String(ws.getCell("H2").value)).toContain("JOURNEY LOG OF UAS");
    expect(ws.getCell(LAYOUT.registration).value).toBe("JU1234567890 / DJI Mavic 4 Pro");
    expect(ws.getCell(LAYOUT.pageNumber).value).toBe("（NR. 1）");
    expect(ws.getCell("B5").value).toBe("2026/10/21");
    expect(ws.getCell("L5").value).toBe("14:03");
    expect(ws.getCell("P5").value).toBe("0:13");
    expect(ws.getCell("C21").value).toBe("2026/10/21");
    expect(ws.getCell("K21").value).toBe("交換");
    expect(ws.model.merges).toContain("Q5:R5");
  });

  it("embeds the pilot's signature image on signed flights only", async () => {
    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
    const flights = [
      { ...makeFlight(0), pilotId: "p1" }, // signed
      { ...makeFlight(1), pilotId: "p1" }, // unsigned
    ];
    const ws = (
      await read(await buildJournalWorkbook(template, { aircraftLabel: "JU1", flights, squawks: [], signatures: { p1: png } }))
    ).worksheets[0];
    const images = ws.getImages();
    expect(images).toHaveLength(1);
    expect(Math.floor(images[0].range.tl.nativeRow)).toBe(LAYOUT.firstFlightRow - 1);
    expect(ws.getCell("D5").value).toBe("山田 太郎（1-23-456）");
    expect(ws.getCell("D5").font.color?.argb).toBe("FF000000");
  });

  it("adds a sheet per 15 flights", async () => {
    const flights = Array.from({ length: 16 }, (_, i) => makeFlight(i));
    const wb = await read(await buildJournalWorkbook(template, { aircraftLabel: "JU1", flights, squawks: [] }));
    expect(wb.worksheets.map((w) => w.name)).toEqual(["NR.1", "NR.2"]);
    const second = wb.worksheets[1];
    expect(second.getCell(LAYOUT.pageNumber).value).toBe("（NR. 2）");
    expect(second.getCell("B5").value).toBe("2026/11/05");
    expect(second.getCell("B6").value).toBeNull();
    expect(String(second.getCell("H2").value)).toContain("JOURNEY LOG OF UAS");
  });
});
