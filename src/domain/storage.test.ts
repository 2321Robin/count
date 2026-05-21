/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultData } from "./defaultData";
import { loadAppData, saveAppData, STORAGE_KEY } from "./storage";

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
    const data = loadAppData();

    expect(data.version).toBe(1);
    expect(data.creatures.length).toBeGreaterThan(0);
  });

  it("saves and loads app data", () => {
    const data = createDefaultData();
    const changed = { ...data, creatures: [{ ...data.creatures[0], name: "已保存" }] };

    saveAppData(changed);

    expect(loadAppData().creatures[0].name).toBe("已保存");
  });

  it("migrates old default creature targets to 80 while keeping counts", () => {
    const oldData = createDefaultData();
    const saved = {
      ...oldData,
      creatures: oldData.creatures.map((creature, index) => ({
        ...creature,
        targetCount: index === 0 ? 500 : creature.targetCount,
        currentEncounters: index === 0 ? 12 : creature.currentEncounters,
        totalEncounters: index === 0 ? 34 : creature.totalEncounters,
        location: index === 0 ? "限定异色精灵" : creature.location,
        notes: index === 0 ? "Past" : creature.notes,
      })),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

    const loaded = loadAppData();

    expect(loaded.creatures[0]).toMatchObject({
      targetCount: 80,
      currentEncounters: 12,
      totalEncounters: 34,
      location: "",
      notes: "",
    });
  });

  it("migrates old records with per-creature acquisition numbers", () => {
    const data = createDefaultData();
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, records: oldRecords }));

    const loaded = loadAppData();

    expect(loaded.records.map((record) => record.acquisitionNumber)).toEqual([2, 1, 1]);
  });

  it("falls back to defaults for malformed storage", () => {
    localStorage.setItem(STORAGE_KEY, "not json");

    expect(loadAppData().version).toBe(1);
  });
});
