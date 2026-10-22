import path from "node:path";
import { Font } from "@react-pdf/renderer";

/** BIZ UDPGothic (Morisawa, OFL) — the universal-design face used across Japanese public documents. */
export const PDF_FONT = "BIZUDPGothic";

let registered = false;

const CJK = /[　-ヿ㐀-鿿豈-﫿＀-￯]/;

export function registerPdfFonts() {
  if (registered) return;
  const dir = path.join(process.cwd(), "src/assets/fonts");
  Font.register({
    family: PDF_FONT,
    fonts: [
      { src: path.join(dir, "BIZUDPGothic-Regular.ttf"), fontWeight: 400 },
      { src: path.join(dir, "BIZUDPGothic-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // Japanese has no spaces: allow a line break between any two CJK characters,
  // while keeping Latin words whole.
  Font.registerHyphenationCallback((word) => (CJK.test(word) ? Array.from(word) : [word]));
  registered = true;
}
