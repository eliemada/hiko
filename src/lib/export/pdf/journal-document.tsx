import { Document, Image, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import { formatHoursMinutes } from "../../flight/format";
import { FLIGHT_ROWS_PER_PAGE, paginateJournal, SQUAWK_ROWS_PER_PAGE } from "../../flight/journal";
import { toJournalRow, toSquawkRow, type JournalFlight, type JournalSquawk } from "../journal-rows";
import { PDF_FONT } from "./fonts";

export interface PdfJournalInput {
  aircraft: { label: string; registrationId: string; model: string; serialNumber: string; name: string };
  flights: (JournalFlight & { id: string; pilotId: string })[];
  squawks: JournalSquawk[];
  pilots: { id: string; name: string; licenseNumber: string | null }[];
  signatures: Record<string, string | null>;
  initialSeconds: number;
  generatedAt: Date;
}

const INK = "#1a1a1a";
const RULE = "#3a3a3a";
const MUTED = "#6b6b6b";
const VERMILION = "#c8312b";
const PAPER_TINT = "#f6f4ef";

const s = StyleSheet.create({
  page: { fontFamily: PDF_FONT, color: INK, paddingVertical: 26, paddingHorizontal: 30, fontSize: 7.5 },
  // Cover
  coverFrame: { flex: 1, borderWidth: 1.2, borderColor: INK, padding: 4 },
  coverInner: { flex: 1, borderWidth: 0.4, borderColor: INK, paddingVertical: 34, paddingHorizontal: 56 },
  coverKicker: { fontSize: 9, letterSpacing: 3, color: MUTED, textAlign: "center" },
  coverTitle: { fontSize: 34, fontWeight: 700, letterSpacing: 10, textAlign: "center", marginTop: 14 },
  coverSubtitle: { fontSize: 11, letterSpacing: 6, textAlign: "center", marginTop: 8, color: MUTED },
  coverRule: { height: 0.6, backgroundColor: INK, marginVertical: 22, marginHorizontal: 120 },
  coverGrid: { flexDirection: "row", gap: 28 },
  coverCol: { flex: 1 },
  kvRow: { flexDirection: "row", borderBottomWidth: 0.4, borderBottomColor: RULE, paddingVertical: 6, alignItems: "flex-end" },
  kvKey: { width: 112 },
  kvJa: { fontSize: 9, fontWeight: 700 },
  kvEn: { fontSize: 6, letterSpacing: 1, color: MUTED, marginTop: 1 },
  kvValue: { flex: 1, fontSize: 11 },
  sectionTitle: { fontSize: 9, fontWeight: 700, marginBottom: 6 },
  pilotHead: { flexDirection: "row", backgroundColor: PAPER_TINT, borderTopWidth: 0.8, borderBottomWidth: 0.4, borderColor: INK, paddingVertical: 4 },
  pilotRow: { flexDirection: "row", borderBottomWidth: 0.4, borderBottomColor: RULE, paddingVertical: 5 },
  seal: {
    position: "absolute",
    right: 60,
    bottom: 46,
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: VERMILION,
    alignItems: "center",
    justifyContent: "center",
  },
  sealText: { color: VERMILION, fontSize: 13, fontWeight: 700, letterSpacing: 1 },
  coverFoot: { position: "absolute", left: 64, bottom: 44, fontSize: 7, color: MUTED },
  // Sheet
  head: { flexDirection: "row", alignItems: "flex-end", marginBottom: 8 },
  regBox: { borderWidth: 0.8, borderColor: INK, paddingVertical: 3, paddingHorizontal: 6, alignItems: "center" },
  regValue: { flex: 1, borderBottomWidth: 0.8, borderBottomColor: INK, marginLeft: 8, paddingBottom: 3, fontSize: 9.5, fontWeight: 700 },
  titleBox: { width: 250, alignItems: "center" },
  title: { fontSize: 15, fontWeight: 700, letterSpacing: 5 },
  titleEn: { fontSize: 7.5, letterSpacing: 4, marginTop: 2 },
  nr: { width: 70, textAlign: "right", fontSize: 9 },
  table: { borderTopWidth: 0.9, borderLeftWidth: 0.9, borderColor: INK },
  tr: { flexDirection: "row" },
  th: {
    borderRightWidth: 0.6,
    borderBottomWidth: 0.9,
    borderColor: INK,
    backgroundColor: PAPER_TINT,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
    height: 32,
  },
  thJa: { fontSize: 7.5, fontWeight: 700, textAlign: "center" },
  thEn: { fontSize: 5, letterSpacing: 0.4, textAlign: "center", marginTop: 1.5 },
  // Fixed row height like the paper form; long text is clipped rather than growing the row.
  td: { borderRightWidth: 0.6, borderBottomWidth: 0.5, borderColor: RULE, justifyContent: "center", paddingHorizontal: 3, height: 22.5, overflow: "hidden" },
  center: { textAlign: "center" },
  small: { fontSize: 6.2, lineHeight: 1.25 },
  num: { textAlign: "center", fontSize: 8 },
  sig: { height: 10.5, objectFit: "contain", objectPosition: "left", marginTop: 1 },
  date: { textAlign: "center", fontSize: 7.2 },
  watermark: {
    position: "absolute",
    top: 220,
    left: 180,
    fontSize: 90,
    color: "#000000",
    opacity: 0.045,
    transform: "rotate(-16deg)",
    letterSpacing: 18,
    fontWeight: 700,
  },
  foot: { position: "absolute", bottom: 12, left: 30, right: 30, flexDirection: "row", justifyContent: "space-between", fontSize: 6, color: MUTED },
});

/** Column widths (fractions of the table) mirroring the official template's proportions. */
const FLIGHT_COLS = [7.6, 13.4, 17.8, 10.8, 10.8, 5.2, 5.2, 5.8, 6.4, 17];
const SQUAWK_COLS = [5, 10, 31, 10, 32, 12];
const pct = (n: number) => `${n}%`;

function Th({ ja, en, w }: { ja: string; en: string; w: number }) {
  return (
    <View style={[s.th, { width: pct(w) }]}>
      <Text style={s.thJa}>{ja}</Text>
      <Text style={s.thEn}>{en}</Text>
    </View>
  );
}

function Td({ w, children, style }: { w: number; children?: React.ReactNode; style?: Style }) {
  return (
    <View style={[s.td, { width: pct(w) }, style ?? {}]}>
      {typeof children === "string" ? <Text style={s.small}>{children}</Text> : children}
    </View>
  );
}

function KV({ ja, en, value }: { ja: string; en: string; value: string }) {
  return (
    <View style={s.kvRow}>
      <View style={s.kvKey}>
        <Text style={s.kvJa}>{ja}</Text>
        <Text style={s.kvEn}>{en}</Text>
      </View>
      <Text style={s.kvValue}>{value || "—"}</Text>
    </View>
  );
}

function CoverPage({ input }: { input: PdfJournalInput }) {
  const { aircraft, flights, pilots } = input;
  const rows = flights.map(toJournalRow);
  const period = rows.length ? `${rows[0].date} 〜 ${rows.at(-1)!.date}` : "—";
  const total = input.initialSeconds + flights.reduce((t, f) => t + f.durationSec, 0);
  const perPilot = pilots
    .map((p) => {
      const own = flights.filter((f) => f.pilotId === p.id);
      return { ...p, count: own.length, sec: own.reduce((t, f) => t + f.durationSec, 0) };
    })
    .filter((p) => p.count > 0);
  const generated = input.generatedAt.toISOString().slice(0, 10).replaceAll("-", "/");

  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <View style={s.coverFrame}>
        <View style={s.coverInner}>
          <Text style={s.coverKicker}>無人航空機の飛行記録 · 国土交通省 様式1</Text>
          <Text style={s.coverTitle}>無人航空機 飛行日誌</Text>
          <Text style={s.coverSubtitle}>UAS JOURNEY LOG</Text>
          <View style={s.coverRule} />
          <View style={s.coverGrid}>
            <View style={s.coverCol}>
              <Text style={s.sectionTitle}>機体情報 Aircraft</Text>
              <KV ja="登録記号" en="REGISTRATION ID" value={aircraft.registrationId} />
              <KV ja="型式" en="MODEL" value={aircraft.model || aircraft.name} />
              <KV ja="製造番号" en="SERIAL NUMBER" value={aircraft.serialNumber} />
              <KV ja="記録期間" en="PERIOD" value={period} />
              <KV ja="飛行回数" en="FLIGHTS" value={`${flights.length} 回`} />
              <KV ja="総飛行時間" en="TOTAL FLIGHT TIME" value={formatHoursMinutes(total)} />
            </View>
            <View style={s.coverCol}>
              <Text style={s.sectionTitle}>操縦者 Pilots</Text>
              <View style={s.pilotHead}>
                <Text style={{ flex: 2, paddingLeft: 4, fontWeight: 700 }}>氏名 Name</Text>
                <Text style={{ flex: 2, fontWeight: 700 }}>技能証明番号 Certificate</Text>
                <Text style={{ flex: 1, textAlign: "right", fontWeight: 700 }}>回数</Text>
                <Text style={{ flex: 1, textAlign: "right", paddingRight: 4, fontWeight: 700 }}>時間</Text>
              </View>
              {perPilot.length === 0 && <Text style={{ paddingVertical: 6, color: MUTED }}>—</Text>}
              {perPilot.map((p) => (
                <View key={p.id} style={s.pilotRow}>
                  <Text style={{ flex: 2, paddingLeft: 4, fontSize: 9 }}>{p.name}</Text>
                  <Text style={{ flex: 2, fontSize: 8 }}>{p.licenseNumber ?? "—"}</Text>
                  <Text style={{ flex: 1, textAlign: "right", fontSize: 9 }}>{p.count}</Text>
                  <Text style={{ flex: 1, textAlign: "right", paddingRight: 4, fontSize: 9 }}>{formatHoursMinutes(p.sec)}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
      <View style={s.seal}>
        <Text style={s.sealText}>日誌</Text>
      </View>
      <Text style={s.coverFoot}>作成日 Generated {generated} · Hikō</Text>
    </Page>
  );
}

function SheetPage({
  input,
  number,
  total,
  flights,
  squawks,
}: {
  input: PdfJournalInput;
  number: number;
  total: number;
  flights: PdfJournalInput["flights"];
  squawks: JournalSquawk[];
}) {
  const draft = flights.some((f) => !f.signedAt);
  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      {draft && <Text style={s.watermark}>下書き</Text>}
      <View style={s.head}>
        <View style={s.regBox}>
          <Text style={{ fontSize: 7, fontWeight: 700 }}>無人航空機の登録記号</Text>
          <Text style={{ fontSize: 5, letterSpacing: 0.5, marginTop: 1 }}>REGISTRATION ID OF UAS</Text>
        </View>
        <Text style={s.regValue}>{input.aircraft.label}</Text>
        <View style={s.titleBox}>
          <Text style={s.title}>無人航空機の飛行記録</Text>
          <Text style={s.titleEn}>JOURNEY LOG OF UAS</Text>
        </View>
        <Text style={s.nr}>（NR. {number}）</Text>
      </View>

      <View style={s.table}>
        <View style={s.tr}>
          <Th ja="飛行年月日" en="FLIGHT DATE" w={FLIGHT_COLS[0]} />
          <Th ja="飛行させた者の氏名" en="NAME OF PILOT" w={FLIGHT_COLS[1]} />
          <Th ja="飛行概要" en="NATURE OF FLIGHT" w={FLIGHT_COLS[2]} />
          <Th ja="離陸場所" en="FROM" w={FLIGHT_COLS[3]} />
          <Th ja="着陸場所" en="TO" w={FLIGHT_COLS[4]} />
          <Th ja="離陸時刻" en="OFF TIME" w={FLIGHT_COLS[5]} />
          <Th ja="着陸時刻" en="ON TIME" w={FLIGHT_COLS[6]} />
          <Th ja="飛行時間" en="FLIGHT TIME" w={FLIGHT_COLS[7]} />
          <Th ja="総飛行時間" en="TOTAL TIME" w={FLIGHT_COLS[8]} />
          <Th ja="飛行の安全に影響のあった事項" en="MATTERS AFFECTED FLIGHT SAFETY" w={FLIGHT_COLS[9]} />
        </View>
        {Array.from({ length: FLIGHT_ROWS_PER_PAGE }, (_, i) => {
          const f = flights[i];
          const r = f ? toJournalRow(f) : null;
          const sig = f?.signedAt ? input.signatures[f.pilotId] : null;
          return (
            <View key={i} style={s.tr} wrap={false}>
              <Td w={FLIGHT_COLS[0]}>
                <Text style={s.date}>{r?.date ?? ""}</Text>
              </Td>
              <Td w={FLIGHT_COLS[1]}>
                {/* Name on top, signature underneath — same as the web sheet and Excel. */}
                <Text style={[s.small, { lineHeight: 1.1 }]}>{r?.pilot ?? ""}</Text>
                {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image has no alt */}
                {sig ? <Image src={sig} style={s.sig} /> : null}
              </Td>
              <Td w={FLIGHT_COLS[2]}>{r?.nature ?? ""}</Td>
              <Td w={FLIGHT_COLS[3]}>{r?.from ?? ""}</Td>
              <Td w={FLIGHT_COLS[4]}>{r?.to ?? ""}</Td>
              <Td w={FLIGHT_COLS[5]}>
                <Text style={s.num}>{r?.off ?? ""}</Text>
              </Td>
              <Td w={FLIGHT_COLS[6]}>
                <Text style={s.num}>{r?.on ?? ""}</Text>
              </Td>
              <Td w={FLIGHT_COLS[7]}>
                <Text style={s.num}>{r?.flightTime ?? ""}</Text>
              </Td>
              <Td w={FLIGHT_COLS[8]}>
                <Text style={s.num}>{r?.totalTime ?? ""}</Text>
              </Td>
              <Td w={FLIGHT_COLS[9]}>{r?.safety ?? ""}</Td>
            </View>
          );
        })}
      </View>

      <View style={[s.table, { marginTop: 9, flexDirection: "row" }]}>
        <View style={[s.th, { width: pct(SQUAWK_COLS[0]), height: "auto", borderBottomWidth: 0.6 }]}>
          <Text style={s.thJa}>記{"\n"}事</Text>
          <Text style={s.thEn}>REPORT</Text>
        </View>
        <View style={{ width: pct(100 - SQUAWK_COLS[0]) }}>
          <View style={s.tr}>
            {(
              [
                ["発生年月日", "SQUAWK DATE"],
                ["不具合事項", "FLIGHT SQUAWK"],
                ["処置年月日", "ACTION DATE"],
                ["処置その他", "CORRECTIVE ACTION"],
                ["確認者", "CONFIRMER"],
              ] as const
            ).map(([ja, en], i) => (
              <View key={ja} style={[s.th, { width: pct((SQUAWK_COLS[i + 1] / (100 - SQUAWK_COLS[0])) * 100), height: 24 }]}>
                <Text style={s.thJa}>{ja}</Text>
                <Text style={s.thEn}>{en}</Text>
              </View>
            ))}
          </View>
          {Array.from({ length: SQUAWK_ROWS_PER_PAGE }, (_, i) => {
            const q = squawks[i] ? toSquawkRow(squawks[i]) : null;
            const w = (n: number) => (SQUAWK_COLS[n] / (100 - SQUAWK_COLS[0])) * 100;
            return (
              <View key={i} style={s.tr}>
                <Td w={w(1)} style={{ height: 17 }}>
                  <Text style={s.num}>{q?.date ?? ""}</Text>
                </Td>
                <Td w={w(2)} style={{ height: 17 }}>{q?.description ?? ""}</Td>
                <Td w={w(3)} style={{ height: 17 }}>
                  <Text style={s.num}>{q?.actionDate ?? ""}</Text>
                </Td>
                <Td w={w(4)} style={{ height: 17 }}>{q?.action ?? ""}</Td>
                <Td w={w(5)} style={{ height: 17 }}>{q?.confirmer ?? ""}</Td>
              </View>
            );
          })}
        </View>
      </View>

      <View style={s.foot} fixed>
        <Text>国土交通省「無人航空機の飛行日誌の取扱要領」様式1準拠 · Generated by Hikō</Text>
        <Text>
          {number} / {total}
        </Text>
      </View>
    </Page>
  );
}

export function JournalDocument({ input }: { input: PdfJournalInput }) {
  const pages = paginateJournal(input.flights, input.squawks);
  return (
    <Document
      title={`飛行日誌 ${input.aircraft.registrationId || input.aircraft.name}`}
      author="Hikō"
      subject="無人航空機の飛行記録 / Journey Log of UAS"
      language="ja"
      creationDate={input.generatedAt}
      modificationDate={input.generatedAt}
    >
      <CoverPage input={input} />
      {pages.map((p) => (
        <SheetPage key={p.number} input={input} number={p.number} total={pages.length} flights={p.flights} squawks={p.squawks} />
      ))}
    </Document>
  );
}
