import { describe, expect, it } from "vitest";
import { bestSerial, componentSerials } from "./serials";

describe("componentSerials", () => {
  it("collects full serials per component", () => {
    const records = [
      { type: "OSD", content: {} },
      { type: "ComponentSerial", content: { componentType: "Aircraft", serial: "1581F8LQC254Q0021TNA" } },
      { type: "ComponentSerial", content: { componentType: "RC", serial: "6UZTN4V0014726" } },
      { type: "ComponentSerial", content: { componentType: { Unknown: 9 }, serial: "X" } },
    ];
    expect(componentSerials(records)).toEqual({ aircraft: "1581F8LQC254Q0021TNA", rc: "6UZTN4V0014726" });
  });
});

describe("bestSerial", () => {
  it("upgrades a truncated header serial", () => {
    expect(bestSerial("1581F8LQC254Q002", "1581F8LQC254Q0021TNA")).toBe("1581F8LQC254Q0021TNA");
  });
  it("keeps the header when the record disagrees or is missing", () => {
    expect(bestSerial("ABC", "XYZ123")).toBe("ABC");
    expect(bestSerial("ABC", undefined)).toBe("ABC");
    expect(bestSerial("", "XYZ")).toBe("XYZ");
  });
});
