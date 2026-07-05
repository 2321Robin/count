/**
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";
import { normalizeRecordDate } from "./dateTime";
import { createDefaultData } from "./defaultData";
import { exportAppData, parseImportedData } from "./importExport";

describe("date time helpers", () => {
  it("normalizes record dates to second precision", () => {
    expect(normalizeRecordDate("2026-05-22")).toBe("2026-05-22T00:00:00");
    expect(normalizeRecordDate("2026-05-22T08:09")).toBe("2026-05-22T08:09:00");
    expect(normalizeRecordDate("2026-05-22T08:09:10")).toBe("2026-05-22T08:09:10");
  });
});

describe("import export", () => {
  it("exports formatted JSON", () => {
    const json = exportAppData(createDefaultData());

    expect(JSON.parse(json).version).toBe(3);
    expect(json).toContain("\n");
  });

  it("parses valid imported v2 data", () => {
    const data = createDefaultData();
    const result = parseImportedData(JSON.stringify(data));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.creatures).toHaveLength(data.creatures.length);
  });

  it("parses imported data with the selected season context", () => {
    const data = createDefaultData("s3");
    const result = parseImportedData(JSON.stringify(data), "s3");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual(createDefaultData("s3"));
  });

  it("does not repair imported S2 default metadata while importing into S3", () => {
    const data = createDefaultData("s2");
    const changed = {
      ...data,
      creatures: data.creatures.map((creature, index) => index === 0 ? { ...creature, targetCount: 500, location: "S2 旧地点", notes: "S2 旧备注" } : creature),
    };

    const result = parseImportedData(JSON.stringify(changed), "s3");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.creatures[0]).toMatchObject({ targetCount: 500, location: "S2 旧地点", notes: "S2 旧备注" });
    }
  });

  it("parses and migrates valid imported v1 data", () => {
    const data = createDefaultData();
    const { giftedRecords: _giftedRecords, currentRound: _currentRound, ...v1Data } = data;
    const result = parseImportedData(JSON.stringify({ ...v1Data, version: 1 }));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.version).toBe(3);
      expect(result.data.giftedRecords).toEqual([]);
      expect(result.data.currentRound).toBeNull();
    }
  });

  it("accepts record timestamps with seconds", () => {
    const data = createDefaultData();
    const result = parseImportedData(JSON.stringify({
      ...data,
      records: [{
        id: "record-1",
        creatureId: data.creatures[0].id,
        creatureName: data.creatures[0].name,
        date: "2026-05-22T08:09:10",
        acquisitionNumber: 1,
        roundEncounters: 5,
        roundBreakdown: [{ creatureId: data.creatures[0].id, creatureName: data.creatures[0].name, encounters: 5 }],
        totalEncountersAtRecord: 25,
        location: "S2 区域",
        notes: "",
      }],
    }));

    expect(result.ok).toBe(true);
  });

  it("accepts gifted records", () => {
    const data = createDefaultData();
    const result = parseImportedData(JSON.stringify({
      ...data,
      giftedRecords: [{
        id: "gift-1",
        creatureId: data.creatures[0].id,
        creatureName: data.creatures[0].name,
        receivedAt: "2026-05-22T08:09:10",
        giftedBy: "朋友",
        notes: "送的",
      }],
    }));

    expect(result.ok).toBe(true);
  });

  it("rejects records with invalid date formats", () => {
    const data = createDefaultData();
    const result = parseImportedData(JSON.stringify({
      ...data,
      records: [{
        id: "record-1",
        creatureId: data.creatures[0].id,
        creatureName: data.creatures[0].name,
        date: "2026/05/22",
        acquisitionNumber: 1,
        roundEncounters: 5,
        roundBreakdown: [{ creatureId: data.creatures[0].id, creatureName: data.creatures[0].name, encounters: 5 }],
        totalEncountersAtRecord: 25,
        location: "S2 区域",
        notes: "",
      }],
    }));

    expect(result).toEqual({ ok: false, error: "导入数据结构不完整。" });
  });

  it("rejects malformed JSON", () => {
    const result = parseImportedData("not json");

    expect(result).toEqual({ ok: false, error: "导入文件不是有效的 JSON。" });
  });

  it("rejects data with missing required fields", () => {
    const result = parseImportedData(JSON.stringify({ version: 3, creatures: [] }));

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
            acquisitionNumber: 1,
            roundEncounters: 5,
            roundBreakdown: [{ creatureId: data.creatures[0].id, creatureName: data.creatures[0].name, encounters: 5 }],
            totalEncountersAtRecord: 25,
            location: "S2 区域",
            notes: "",
          },
        ],
      }),
    );

    expect(result).toEqual({ ok: false, error: "导入数据结构不完整。" });
  });

  it("rejects gifted records whose creature ID does not exist", () => {
    const data = createDefaultData();
    const result = parseImportedData(JSON.stringify({
      ...data,
      giftedRecords: [{
        id: "gift-1",
        creatureId: "missing-creature",
        creatureName: data.creatures[0].name,
        receivedAt: "2026-05-22T08:09:10",
        giftedBy: "朋友",
        notes: "送的",
      }],
    }));

    expect(result).toEqual({ ok: false, error: "导入数据结构不完整。" });
  });

  it("rejects duplicate record IDs", () => {
    const data = createDefaultData();
    const record = {
      id: "record-1",
      creatureId: data.creatures[0].id,
      creatureName: data.creatures[0].name,
      date: "2026-05-22",
      acquisitionNumber: 1,
      roundEncounters: 5,
      roundBreakdown: [{ creatureId: data.creatures[0].id, creatureName: data.creatures[0].name, encounters: 5 }],
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
