/**
 * The unencrypted log header stores serials in a 16-byte field, so DJI's
 * newer 20-character serials (e.g. 1581F8LQC254Q0021TNA) arrive truncated.
 * The full value is in the encrypted ComponentSerial records.
 */
export interface ComponentSerials {
  aircraft?: string;
  rc?: string;
  battery?: string;
  camera?: string;
}

type RecordLike = { type: string; content?: unknown };

const KEY: Record<string, keyof ComponentSerials> = { Aircraft: "aircraft", RC: "rc", Battery: "battery", Camera: "camera" };

export function componentSerials(records: readonly RecordLike[]): ComponentSerials {
  const out: ComponentSerials = {};
  for (const r of records) {
    if (r.type !== "ComponentSerial") continue;
    const c = r.content as { componentType?: unknown; serial?: unknown };
    const key = typeof c.componentType === "string" ? KEY[c.componentType] : undefined;
    const serial = typeof c.serial === "string" ? c.serial.trim() : "";
    if (key && serial && !out[key]) out[key] = serial;
  }
  return out;
}

/** Prefer the full serial when it extends the (truncated) header one. */
export function bestSerial(header: string, full: string | undefined): string {
  if (!full) return header;
  if (!header || full.startsWith(header)) return full;
  return header;
}
