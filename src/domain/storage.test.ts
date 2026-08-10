/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultData } from "./defaultData";
import { loadAppData, saveAppData, S2_STORAGE_KEY, S3_STORAGE_KEY } from "./storage";

describe("storage", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    localStorage.clear();
  });

  it("loads defaults when storage is empty", () => {
    const result = loadAppData("s2");

    expect(result.recovered).toBe(false);
    expect(result.data.version).toBe(5);
    expect(result.data.creatures.length).toBeGreaterThan(0);
    expect(result.data.giftedRecords).toEqual([]);
  });

  it("saves and loads S2 app data from the existing key", () => {
    const data = createDefaultData("s2");
    const changed = { ...data, creatures: [{ ...data.creatures[0], name: "已保存" }] };

    saveAppData("s2", changed);

    expect(localStorage.getItem(S2_STORAGE_KEY)).toBe(JSON.stringify(changed));
    expect(localStorage.getItem(S3_STORAGE_KEY)).toBeNull();
    expect(loadAppData("s2").data.creatures[0].name).toBe("已保存");
  });

  it("isolates S3 storage from S2 storage", () => {
    const s2Data = createDefaultData("s2");
    const s3Data = { ...createDefaultData("s3"), creatures: [{ id: "s3-custom", name: "S3 自定义", targetCount: 80, currentEncounters: 0, totalEncounters: 0, location: "", notes: "", isDefault: false }] };

    saveAppData("s2", s2Data);
    saveAppData("s3", s3Data);

    expect(loadAppData("s2").data.creatures[0].name).toBe("猴麦仔");
    expect(loadAppData("s3").data.creatures[0].name).toBe("S3 自定义");
    expect(localStorage.getItem(S2_STORAGE_KEY)).toBe(JSON.stringify(s2Data));
    expect(localStorage.getItem(S3_STORAGE_KEY)).toBe(JSON.stringify(s3Data));
  });

  it("loads S3 defaults without falling back to S2 data", () => {
    localStorage.setItem(S2_STORAGE_KEY, JSON.stringify(createDefaultData("s2")));

    const loaded = loadAppData("s3");

    expect(loaded.data).toEqual({ ...createDefaultData("s3"), meta: expect.objectContaining({ lastModifiedBy: "unknown" }) });
    expect(loaded.data.creatures.length).toBe(20);
    expect(loaded.data.creatures[0].name).toBe("苞米仔");
  });

  it("migrates v1 default creature targets while keeping counts", () => {
    const oldData = createDefaultData("s2");
    const saved = {
      ...oldData,
      version: 1,
      giftedRecords: undefined,
      currentRound: undefined,
      creatures: oldData.creatures.map((creature, index) => ({
        ...creature,
        targetCount: index === 0 ? 500 : creature.targetCount,
        currentEncounters: index === 0 ? 12 : creature.currentEncounters,
        totalEncounters: index === 0 ? 34 : creature.totalEncounters,
        location: index === 0 ? "限定异色精灵" : creature.location,
        notes: index === 0 ? "Past" : creature.notes,
      })),
    };
    localStorage.setItem(S2_STORAGE_KEY, JSON.stringify(saved));

    const loaded = loadAppData("s2");

    expect(loaded.data.version).toBe(5);
    expect(loaded.data.creatures[0]).toMatchObject({
      targetCount: 80,
      currentEncounters: 12,
      totalEncounters: 34,
      location: "",
      notes: "",
    });
    expect(loaded.data.fairyTaleBookRecords).toEqual([]);
    expect(loaded.data.currentRound?.creatureIds).toEqual([oldData.creatures[0].id]);
    expect(loaded.data.giftedRecords).toEqual([]);
  });

  it("migrates old records with acquisition numbers, timestamps, and breakdowns", () => {
    const data = createDefaultData("s2");
    const oldRecords = [
      {
        id: "record-newest-first-creature",
        creatureId: data.creatures[0].id,
        creatureName: data.creatures[0].name,
        date: "2026-05-24",
        roundEncounters: 6,
        totalEncountersAtRecord: 18,
        location: "",
        notes: "",
      },
      {
        id: "record-other-creature",
        creatureId: data.creatures[1].id,
        creatureName: data.creatures[1].name,
        date: "2026-05-23",
        roundEncounters: 7,
        totalEncountersAtRecord: 7,
        location: "",
        notes: "",
      },
      {
        id: "record-oldest-first-creature",
        creatureId: data.creatures[0].id,
        creatureName: data.creatures[0].name,
        date: "2026-05-22",
        roundEncounters: 12,
        totalEncountersAtRecord: 12,
        location: "",
        notes: "",
      },
    ];
    localStorage.setItem(S2_STORAGE_KEY, JSON.stringify({ ...data, version: 1, giftedRecords: undefined, currentRound: undefined, records: oldRecords }));

    const loaded = loadAppData("s2");

    expect(loaded.data.records.map((record) => record.acquisitionNumber)).toEqual([2, 1, 1]);
    expect(loaded.data.records.map((record) => record.date)).toEqual([
      "2026-05-24T00:00:00",
      "2026-05-23T00:00:00",
      "2026-05-22T00:00:00",
    ]);
    expect(loaded.data.records[0].roundBreakdown).toEqual([
      { creatureId: data.creatures[0].id, creatureName: data.creatures[0].name, encounters: 6 },
    ]);
  });

  it("migrates v2 gifted record timestamps", () => {
    const data = createDefaultData("s2");
    localStorage.setItem(S2_STORAGE_KEY, JSON.stringify({
      ...data,
      giftedRecords: [{
        id: "gift-1",
        creatureId: data.creatures[0].id,
        creatureName: data.creatures[0].name,
        receivedAt: "2026-05-24",
        giftedBy: "朋友",
        notes: "送的",
      }],
    }));

    const loaded = loadAppData("s2");

    expect(loaded.data.giftedRecords[0].receivedAt).toBe("2026-05-24T00:00:00");
  });

  it("falls back to selected-season defaults for malformed storage", () => {
    localStorage.setItem(S3_STORAGE_KEY, "not json");

    expect(loadAppData("s3").data).toEqual({ ...createDefaultData("s3"), meta: expect.objectContaining({ lastModifiedBy: "unknown" }) });
  });

  it("backs up corrupt JSON and returns recovered defaults", () => {
    localStorage.setItem(S2_STORAGE_KEY, "{corrupt");

    const result = loadAppData("s2");

    expect(result.recovered).toBe(true);
    expect(result.data).toEqual({ ...createDefaultData("s2"), meta: expect.objectContaining({ lastModifiedBy: "unknown" }) });
    expect(localStorage.getItem(`${S2_STORAGE_KEY}-corrupt`)).toBe("{corrupt");
  });

  it("backs up unmigratable future data and returns recovered defaults", () => {
    const future = { ...createDefaultData("s3"), version: 99 };
    localStorage.setItem(S3_STORAGE_KEY, JSON.stringify(future));

    const result = loadAppData("s3");

    expect(result.recovered).toBe(true);
    expect(result.data).toEqual({ ...createDefaultData("s3"), meta: expect.objectContaining({ lastModifiedBy: "unknown" }) });
    expect(localStorage.getItem(`${S3_STORAGE_KEY}-corrupt`)).toBe(JSON.stringify(future));
  });

  it("migrates v4 data by adding a fallback meta stamp", () => {
    // 手工构造 v4 数据：createDefaultData 已是 v5，用 JSON 往返降级
    const v4 = JSON.parse(JSON.stringify({ ...createDefaultData("s2"), version: 4 }));
    localStorage.setItem(S2_STORAGE_KEY, JSON.stringify(v4));

    const result = loadAppData("s2");

    expect(result.recovered).toBe(false);
    expect(result.data.version).toBe(5);
    expect(result.data.meta.lastModifiedBy).toBe("unknown");
    expect(typeof result.data.meta.lastModifiedAt).toBe("string");
  });

  it("backs up a fallback meta for v5 data missing meta", () => {
    const v5NoMeta = JSON.parse(JSON.stringify(createDefaultData("s2")));
    delete v5NoMeta.meta;
    localStorage.setItem(S2_STORAGE_KEY, JSON.stringify(v5NoMeta));

    const result = loadAppData("s2");

    expect(result.recovered).toBe(false);
    expect(result.data.version).toBe(5);
    expect(result.data.meta.lastModifiedBy).toBe("unknown");
    expect(typeof result.data.meta.lastModifiedAt).toBe("string");
  });

  it("reports no recovery when storage is empty", () => {
    expect(loadAppData("s2")).toEqual({ data: { ...createDefaultData("s2"), meta: expect.objectContaining({ lastModifiedBy: "unknown" }) }, recovered: false });
  });
});
