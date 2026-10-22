import { toJournalRow, toSquawkRow, type JournalFlight, type JournalSquawk } from "@/lib/export/journal-rows";
import { FLIGHT_ROWS_PER_PAGE, SQUAWK_ROWS_PER_PAGE } from "@/lib/flight/journal";
import { cn } from "@/lib/utils";

interface Props {
  number: number;
  aircraftLabel: string;
  flights: (JournalFlight & { id: string; pilotId: string })[];
  squawks: JournalSquawk[];
  signatures: Record<string, string | null>;
  draft: boolean;
}

function H({ ja, en, className }: { ja: string; en: string; className?: string }) {
  return (
    <th className={cn("border border-black/70 px-1 py-1 text-center align-middle font-normal", className)}>
      <div className="text-[10.5px] leading-tight font-medium">{ja}</div>
      <div className="text-[8px] leading-tight tracking-wide">{en}</div>
    </th>
  );
}

const cell = "border border-black/70 px-1.5 align-middle";

/** Faithful HTML replica of MLIT 様式1 — one A4-landscape sheet. */
export function JournalSheet({ number, aircraftLabel, flights, squawks, signatures, draft }: Props) {
  const rows = Array.from({ length: FLIGHT_ROWS_PER_PAGE }, (_, i) => flights[i]);
  const reports = Array.from({ length: SQUAWK_ROWS_PER_PAGE }, (_, i) => squawks[i]);

  return (
    <article
      className="journal-sheet relative mx-auto aspect-[297/210] w-full max-w-[1123px] overflow-hidden bg-paper p-[2.6%] text-paper-foreground shadow-[0_8px_32px_oklch(0_0_0/0.12)] ring-1 ring-black/5 print:aspect-auto print:max-w-none print:p-0 print:shadow-none print:ring-0"
      style={{ fontFamily: '"Noto Sans JP", var(--font-sans)' }}
    >
      {draft && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 grid place-items-center text-[120px] font-bold tracking-[0.3em] text-black/[0.04] select-none print:text-black/[0.06]"
          style={{ transform: "rotate(-18deg)" }}
        >
          下書き
        </div>
      )}
      <div className="mb-[1.2%] grid grid-cols-[auto_1fr_auto_auto] items-end gap-3">
        <div className="border border-black/70 px-2 py-1 text-center">
          <div className="text-[10px] font-medium">無人航空機の登録記号</div>
          <div className="text-[8px] tracking-wide">REGISTRATION ID OF UAS</div>
        </div>
        <div className="border-b border-black/70 pb-1 font-mono text-[12px] font-semibold">{aircraftLabel}</div>
        <div className="px-6 text-center">
          <div className="text-[15px] font-bold tracking-[0.2em]">無人航空機の飛行記録</div>
          <div className="text-[10px] tracking-[0.25em]">JOURNEY LOG OF UAS</div>
        </div>
        <div className="text-[12px] tnum">（NR. {number}）</div>
      </div>

      <table className="w-full table-fixed border-collapse text-[10px] leading-tight">
        <colgroup>
          <col style={{ width: "7.5%" }} />
          <col style={{ width: "13%" }} />
          <col style={{ width: "17.5%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "11%" }} />
          <col style={{ width: "5.5%" }} />
          <col style={{ width: "5.5%" }} />
          <col style={{ width: "6%" }} />
          <col style={{ width: "6.5%" }} />
          <col style={{ width: "16.5%" }} />
        </colgroup>
        <thead>
          <tr className="h-[42px]">
            <H ja="飛行年月日" en="FLIGHT DATE" />
            <H ja="飛行させた者の氏名" en="NAME OF PILOT" />
            <H ja="飛行概要" en="NATURE OF FLIGHT" />
            <H ja="離陸場所" en="FROM" />
            <H ja="着陸場所" en="TO" />
            <H ja="離陸時刻" en="OFF TIME" />
            <H ja="着陸時刻" en="ON TIME" />
            <H ja="飛行時間" en="FLIGHT TIME" />
            <H ja="総飛行時間" en="TOTAL FLIGHT TIME" />
            <H ja="飛行の安全に影響のあった事項" en="MATTERS AFFECTED FLIGHT SAFETY" />
          </tr>
        </thead>
        <tbody>
          {rows.map((f, i) => {
            const r = f ? toJournalRow(f) : null;
            const sig = f && f.signedAt ? signatures[f.pilotId] : null;
            return (
              <tr key={f?.id ?? `empty-${i}`} className="h-[30px]">
                <td className={cn(cell, "text-center tnum")}>{r?.date}</td>
                <td className={cn(cell, "py-0.5")}>
                  {/* Name on top, signature underneath — never overlapping. */}
                  <span className={cn("block truncate", sig && "text-[8.5px] leading-[10px]")} title={r?.pilot}>
                    {r?.pilot}
                  </span>
                  {sig && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sig} alt={`Signature of ${r?.pilot}`} className="mt-px block h-[15px] max-w-full object-contain object-left mix-blend-multiply" />
                  )}
                </td>
                <td className={cell}>
                  <span className="line-clamp-2">{r?.nature}</span>
                </td>
                <td className={cell}>
                  <span className="line-clamp-2">{r?.from}</span>
                </td>
                <td className={cell}>
                  <span className="line-clamp-2">{r?.to}</span>
                </td>
                <td className={cn(cell, "text-center tnum")}>{r?.off}</td>
                <td className={cn(cell, "text-center tnum")}>{r?.on}</td>
                <td className={cn(cell, "text-center tnum")}>{r?.flightTime}</td>
                <td className={cn(cell, "text-center tnum")}>{r?.totalTime}</td>
                <td className={cell}>
                  <span className="line-clamp-2 text-[9px]">{r?.safety}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <table className="mt-[1.2%] w-full table-fixed border-collapse text-[10px] leading-tight">
        <colgroup>
          <col style={{ width: "5%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "30%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "33%" }} />
          <col style={{ width: "12%" }} />
        </colgroup>
        <tbody>
          <tr className="h-[34px]">
            <th rowSpan={SQUAWK_ROWS_PER_PAGE + 1} className="border border-black/70 text-center align-middle font-normal">
              <div className="text-[11px] font-medium [writing-mode:vertical-rl] mx-auto">記事</div>
              <div className="mt-1 text-[8px]">REPORT</div>
            </th>
            <H ja="発生年月日" en="SQUAWK DATE" />
            <H ja="不具合事項" en="FLIGHT SQUAWK" />
            <H ja="処置年月日" en="ACTION DATE" />
            <H ja="処置その他" en="CORRECTIVE ACTION" />
            <H ja="確認者" en="CONFIRMER" />
          </tr>
          {reports.map((s, i) => {
            const r = s ? toSquawkRow(s) : null;
            return (
              <tr key={i} className="h-[24px]">
                <td className={cn(cell, "text-center tnum")}>{r?.date}</td>
                <td className={cell}>
                  <span className="line-clamp-2">{r?.description}</span>
                </td>
                <td className={cn(cell, "text-center tnum")}>{r?.actionDate}</td>
                <td className={cell}>
                  <span className="line-clamp-2">{r?.action}</span>
                </td>
                <td className={cn(cell, "text-center")}>{r?.confirmer}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-1 text-right text-[8px] text-black/50">Generated by Hikō · 国土交通省 様式1準拠</p>
    </article>
  );
}
