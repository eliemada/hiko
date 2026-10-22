import { renderToBuffer } from "@react-pdf/renderer";
import { registerPdfFonts } from "./fonts";
import { JournalDocument, type PdfJournalInput } from "./journal-document";

export async function renderJournalPdf(input: PdfJournalInput): Promise<Buffer> {
  registerPdfFonts();
  return renderToBuffer(<JournalDocument input={input} />);
}
