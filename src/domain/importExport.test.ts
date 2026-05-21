/**
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";
import { createDefaultData } from "./defaultData";
import { exportAppData, parseImportedData } from "./importExport";

describe("import export", () => {
  it("exports formatted JSON", () => {
    const json = exportAppData(createDefaultData());

    expect(JSON.parse(json).version).toBe(1);
    expect(json).toContain("\n");
  });

  it("parses valid imported data", () => {
    const data = createDefaultData();
    const result = parseImportedData(JSON.stringify(data));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.creatures).toHaveLength(data.creatures.length);
  });

  it("rejects malformed JSON", () => {
    const result = parseImportedData("not json");

    expect(result).toEqual({ ok: false, error: "导入文件不是有效的 JSON。" });
  });

  it("rejects data with missing required fields", () => {
    const result = parseImportedData(JSON.stringify({ version: 1, creatures: [] }));

    expect(result).toEqual({ ok: false, error: "导入数据结构不完整。" });
  });

  it("rejects creatures with invalid numeric fields", () => {
    const data = createDefaultData();

    const negativeEncounters = parseImportedData(
      JSON.stringify({
        ...data,
        creatures: [{ ...data.creatures[0], currentEncounters: -1 }],
      }),
    );
    const fractionalTargetCount = parseImportedData(
      JSON.stringify({
        ...data,
        creatures: [{ ...data.creatures[0], targetCount: 1.5 }],
      }),
    );

    expect(negativeEncounters).toEqual({ ok: false, error: "导入数据结构不完整。" });
    expect(fractionalTargetCount).toEqual({ ok: false, error: "导入数据结构不完整。" });
  });

  it("rejects creatures with current encounters greater than total encounters", () => {
    const data = createDefaultData();
    const result = parseImportedData(
      JSON.stringify({
        ...data,
        creatures: [{ ...data.creatures[0], currentEncounters: 11, totalEncounters: 10 }],
      }),
    );

    expect(result).toEqual({ ok: false, error: "导入数据结构不完整。" });
  });

  it("rejects duplicate creature IDs", () => {
    const data = createDefaultData();
    const result = parseImportedData(
      JSON.stringify({
        ...data,
        creatures: [data.creatures[0], { ...data.creatures[1], id: data.creatures[0].id }],
      }),
    );

    expect(result).toEqual({ ok: false, error: "导入数据结构不完整。" });
  });

  it("rejects records whose creature ID does not exist", () => {
    const data = createDefaultData();
    const result = parseImportedData(
      JSON.stringify({
        ...data,
        records: [
          {
            id: "record-1",
            creatureId: "missing-creature",
            creatureName: data.creatures[0].name,
            date: "2026-05-22",
            roundEncounters: 5,
            totalEncountersAtRecord: 25,
            location: "S2 区域",
            notes: "",
          },
        ],
      }),
    );

    expect(result).toEqual({ ok: false, error: "导入数据结构不完整。" });
  });

  it("rejects duplicate record IDs", () => {
    const data = createDefaultData();
    const record = {
      id: "record-1",
      creatureId: data.creatures[0].id,
      creatureName: data.creatures[0].name,
      date: "2026-05-22",
      roundEncounters: 5,
      totalEncountersAtRecord: 25,
      location: "S2 区域",
      notes: "",
    };
    const result = parseImportedData(
      JSON.stringify({
        ...data,
        records: [record, { ...record }],
      }),
    );

    expect(result).toEqual({ ok: false, error: "导入数据结构不完整。" });
  });
});
