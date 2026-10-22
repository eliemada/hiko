import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { renderJournalPdf } from "../src/lib/export/pdf/render";
import type { PdfJournalInput } from "../src/lib/export/pdf/journal-document";
import { buildJournalWorkbook } from "../src/lib/export/xlsx";

const assets = path.resolve("demo/assets");
await mkdir(assets, { recursive: true });
await mkdir("docs/media", { recursive: true });
await copyFile("src/app/icon.svg", path.join(assets, "icon.svg"));
const generatedAt = new Date("2026-10-20T01:00:00.000Z");
const signatureSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="500" height="90"><text x="12" y="62" font-family="sans-serif" font-style="italic" font-size="50" fill="#0b5fd1">SAMPLE PILOT</text></svg>';
const signature = `data:image/png;base64,${(await sharp(Buffer.from(signatureSvg)).png().toBuffer()).toString("base64")}`;
const input: PdfJournalInput = {
  aircraft: { label: "SAMPLE / FICTIONAL AIRCRAFT", registrationId: "SAMPLE-NOT-REGISTERED", model: "Fictional demo aircraft", serialNumber: "FICTIONAL-001", name: "Sample aircraft" },
  pilots: [{ id: "sample", name: "Sample Pilot / 架空の操縦者", licenseNumber: null }],
  signatures: { sample: signature },
  initialSeconds: 0,
  generatedAt,
  squawks: [{ occurredOn: "2026-10-20", description: "架空のサンプル / Fictional demonstration only", actionOn: null, action: null, confirmer: null }],
  flights: [{
    id: "sample-flight", pilotId: "sample", takeoffAt: Date.parse("2026-10-20T00:12:00Z"), landingAt: Date.parse("2026-10-20T00:32:00Z"),
    durationSec: 1200, totalSec: 1200, timeZone: "Asia/Tokyo", pilotName: "Sample Pilot / 架空の操縦者", pilotLicense: null,
    purpose: "訓練 (Training)", specificFlights: [], route: "", takeoffPlace: "架空の飛行場 / Fictional field", landingPlace: "架空の飛行場 / Fictional field",
    safetyNotes: "架空 / SAMPLE: 晴れ Fair, 18°C, 2 m/s", signedAt: null,
  }],
};
const template = await readFile("src/assets/journey-log-template.xlsx");
for (const state of ["draft", "signed"] as const) {
  const data = { ...input, flights: input.flights.map((f) => ({ ...f, signedAt: state === "signed" ? generatedAt : null })) };
  await writeFile(path.join(assets, `sample-${state}.pdf`), await renderJournalPdf(data));
  await writeFile(path.join(assets, `sample-${state}.xlsx`), await buildJournalWorkbook(template, {
    aircraftLabel: data.aircraft.label, flights: data.flights, squawks: data.squawks, signatures: data.signatures, generatedAt,
  }));
}
await writeFile(path.join(assets, "sample-flight.json"), JSON.stringify({ fictional: true, ...input.flights[0] }, null, 2) + "\n");
const logo = (await readFile("src/app/icon.svg", "utf8")).replace('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">', '<svg x="80" y="76" width="56" height="56" viewBox="0 0 64 64">');
const card = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="640" viewBox="0 0 1280 640">
<rect width="1280" height="640" fill="#f5f7fb"/><path d="M760 0h520v640H760z" fill="#e7edf7"/>
${logo}<text x="152" y="116" font-family="sans-serif" font-size="38" font-weight="700" fill="#14243c">Hikō</text>
<text x="80" y="240" font-family="sans-serif" font-size="58" font-weight="700" fill="#14243c">Your flights.</text>
<text x="80" y="310" font-family="sans-serif" font-size="58" font-weight="700" fill="#14243c">Ready for the logbook.</text>
<text x="80" y="380" font-family="sans-serif" font-size="24" fill="#52627a">DJI records → bilingual PDF + Excel</text>
<text x="80" y="420" font-family="sans-serif" font-size="24" fill="#52627a">A self-hosted drone logbook for Japan.</text>
<rect x="80" y="494" width="242" height="44" rx="22" fill="#0b5fd1"/><text x="201" y="523" text-anchor="middle" font-family="sans-serif" font-size="18" font-weight="600" fill="white">OPEN SOURCE · BETA</text>
<g transform="translate(835 105) rotate(5 160 210)"><rect width="350" height="430" rx="10" fill="#fff" stroke="#c9d4e6" stroke-width="2"/>
<text x="175" y="58" text-anchor="middle" font-family="sans-serif" font-size="19" font-weight="700" fill="#14243c">JOURNEY LOG OF UAS</text>
<text x="175" y="82" text-anchor="middle" font-family="sans-serif" font-size="12" fill="#52627a">MLIT FORM 1 · SAMPLE</text>
<rect x="24" y="113" width="302" height="34" fill="#e8eef7"/><path d="M24 113h302v210H24z M24 147h302 M24 182h302 M24 217h302 M24 252h302 M24 287h302 M90 113v210 M166 113v210 M246 113v210" fill="none" stroke="#bac6d8"/>
<text x="38" y="169" font-family="sans-serif" font-size="13" fill="#14243c">20 Oct</text><text x="102" y="169" font-family="sans-serif" font-size="13" fill="#14243c">09:12</text><text x="178" y="169" font-family="sans-serif" font-size="13" fill="#14243c">09:32</text><text x="263" y="169" font-family="sans-serif" font-size="13" fill="#14243c">0:20</text>
<circle cx="276" cy="377" r="28" fill="none" stroke="#0b5fd1" stroke-width="2"/><path d="m262 376 10 10 19-22" fill="none" stroke="#0b5fd1" stroke-width="3"/>
<text x="26" y="380" font-family="sans-serif" font-size="12" fill="#52627a">REVIEW · SIGN · EXPORT</text></g></svg>`;
await writeFile("docs/media/social-preview.svg", card);
await sharp(Buffer.from(card)).png().toFile("docs/media/social-preview.png");
await sharp(Buffer.from(card)).resize(1200, 630, { fit: "cover" }).png().toFile(path.join(assets, "social-preview.png"));
console.log("Built fictional PDF/XLSX samples and social preview images with the application exporters.");
