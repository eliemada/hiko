import ExcelJS from "exceljs";
import { paginateJournal } from "../flight/journal";
import { toJournalRow, toSquawkRow, type JournalFlight, type JournalSquawk } from "./journal-rows";

/** Cell layout of the official MLIT template (様式1). */
export const LAYOUT = {
  registration: "G2",
  pageNumber: "R2",
  firstFlightRow: 5,
  firstSquawkRow: 21,
  flight: { date: "B", pilot: "D", nature: "G", from: "H", to: "I", off: "L", on: "M", time: "O", total: "P", safety: "Q" },
  squawk: { date: "C", description: "E", actionDate: "I", action: "K", confirmer: "R" },
} as const;

export interface JournalExport {
  generatedAt?: Date;
  aircraftLabel: string;
  flights: (JournalFlight & { pilotId?: string })[];
  squawks: JournalSquawk[];
  /** pilotId → PNG data URL, drawn into the pilot cell of signed flights (⑪). */
  signatures?: Record<string, string | null>;
}

/** Signature size inside the merged pilot cell (D:F), in pixels. */
const SIG_SIZE = { width: 84, height: 28 };
/** Signed rows are a bit taller so the name and the signature both fit. */
const SIGNED_ROW_HEIGHT_PT = 36;

const wrap = { wrapText: true, vertical: "middle", shrinkToFit: false } as const;

/** The template's entry cells are styled in red (sample ink); official records are written in black. */
const INK = { argb: "FF000000" };

function setCell(ws: ExcelJS.Worksheet, ref: string, value: string, opts: { small?: boolean } = {}) {
  const cell = ws.getCell(ref);
  cell.value = value;
  cell.alignment = { ...cell.alignment, ...wrap };
  cell.font = { ...cell.font, color: INK, ...(opts.small ? { size: 8 } : {}) };
}

type Page = ReturnType<typeof paginateJournal<JournalExport["flights"][number], JournalSquawk>>[number];

function signatureImageId(wb: ExcelJS.Workbook, cache: Map<string, number>, dataUrl: string): number | null {
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const cached = cache.get(dataUrl);
  if (cached !== undefined) return cached;
  const id = wb.addImage({ base64: match[1], extension: "png" });
  cache.set(dataUrl, id);
  return id;
}

function fillPage(
  wb: ExcelJS.Workbook,
  ws: ExcelJS.Worksheet,
  data: JournalExport,
  page: Page,
  imageCache: Map<string, number>,
) {
  setCell(ws, LAYOUT.registration, data.aircraftLabel);
  ws.getCell(LAYOUT.pageNumber).value = `（NR. ${page.number}）`;

  page.flights.forEach((f, i) => {
    const r = LAYOUT.firstFlightRow + i;
    const row = toJournalRow(f);
    const c = LAYOUT.flight;
    setCell(ws, `${c.date}${r}`, row.date);
    setCell(ws, `${c.pilot}${r}`, row.pilot, { small: true });
    setCell(ws, `${c.nature}${r}`, row.nature, { small: true });
    setCell(ws, `${c.from}${r}`, row.from, { small: true });
    setCell(ws, `${c.to}${r}`, row.to, { small: true });
    setCell(ws, `${c.off}${r}`, row.off);
    setCell(ws, `${c.on}${r}`, row.on);
    setCell(ws, `${c.time}${r}`, row.flightTime);
    setCell(ws, `${c.total}${r}`, row.totalTime);
    setCell(ws, `${c.safety}${r}`, row.safety, { small: true });
    ws.getRow(r).height = Math.max(ws.getRow(r).height ?? 0, 30);

    const sig = row.signed && f.pilotId ? data.signatures?.[f.pilotId] : null;
    const imageId = sig ? signatureImageId(wb, imageCache, sig) : null;
    if (imageId !== null) {
      ws.getRow(r).height = SIGNED_ROW_HEIGHT_PT;
      ws.getCell(`${c.pilot}${r}`).alignment = { wrapText: true, vertical: "top" };
      // Columns are 0-based: D = 3. Sit in the lower half of the merged D:F cell.
      ws.addImage(imageId, { tl: { col: 3.35, row: r - 1 + 0.38 }, ext: SIG_SIZE, editAs: "oneCell" });
    }
  });

  page.squawks.forEach((s, i) => {
    const r = LAYOUT.firstSquawkRow + i;
    const row = toSquawkRow(s);
    const c = LAYOUT.squawk;
    setCell(ws, `${c.date}${r}`, row.date);
    setCell(ws, `${c.description}${r}`, row.description, { small: true });
    setCell(ws, `${c.actionDate}${r}`, row.actionDate);
    setCell(ws, `${c.action}${r}`, row.action, { small: true });
    setCell(ws, `${c.confirmer}${r}`, row.confirmer, { small: true });
  });
}

/** Clone the template sheet (values, styles, merges, print setup) under a new name. */
function cloneSheet(wb: ExcelJS.Workbook, source: ExcelJS.Worksheet, name: string): ExcelJS.Worksheet {
  const copy = wb.addWorksheet(name);
  copy.model = { ...structuredClone(source.model), name } as ExcelJS.WorksheetModel;
  return copy;
}

/** Fill the official template, one sheet per 15 flights. */
export async function buildJournalWorkbook(template: ArrayBuffer | Buffer, data: JournalExport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(template as ArrayBuffer);
  const base = wb.worksheets[0];
  if (!base) throw new Error("Journey log template has no worksheet");

  const pages = paginateJournal(data.flights, data.squawks);
  const sheets = [base, ...pages.slice(1).map((p) => cloneSheet(wb, base, `NR.${p.number}`))];
  base.name = "NR.1";
  const imageCache = new Map<string, number>();
  pages.forEach((page, i) => fillPage(wb, sheets[i], data, page, imageCache));

  wb.creator = "Hikō";
  wb.created = data.generatedAt ?? new Date();
  wb.modified = data.generatedAt ?? new Date();
  return Buffer.from(await wb.xlsx.writeBuffer());
}
