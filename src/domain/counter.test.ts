// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createDefaultData } from "./defaultData";
import {
  addCreature,
  calculateStats,
  decrementEncounter,
  incrementEncounter,
  recordAcquisition,
  removeCreature,
  updateCreature,
} from "./counter";

describe("counter domain", () => {
  it("creates default data with S2 creatures", () => {
    const data = createDefaultData();
    const defaultNames = data.creatures.map((creature) => creature.name);

    expect(data.version).toBe(1);
    expect(defaultNames).toEqual([
      "猴麦仔",
      "烟花团",
      "加油海葵",
      "炫光迪迪",
      "咕咕帽",
      "小丑豆豆",
      "小鼓象",
      "牵线木偶",
      "公平鸽",
      "灵狐",
      "小独角兽",
      "嘟嘟煲",
      "菊花梨",
      "幽影树",
      "小夜",
      "恶魔叮",
      "爆焰喷喷",
      "雪怪",
    ]);
    expect(data.creatures[0]).toMatchObject({
      currentEncounters: 0,
      totalEncounters: 0,
      isDefault: true,
    });
  });

  it("increments current and total encounters", () => {
    const data = createDefaultData();
    const creatureId = data.creatures[0].id;

    const next = incrementEncounter(data, creatureId);

    expect(next.creatures[0].currentEncounters).toBe(1);
    expect(next.creatures[0].totalEncounters).toBe(1);
  });

  it("decrements counts without going below zero", () => {
    const data = createDefaultData();
    const creatureId = data.creatures[0].id;

    const next = decrementEncounter(data, creatureId);

    expect(next.creatures[0].currentEncounters).toBe(0);
    expect(next.creatures[0].totalEncounters).toBe(0);
  });

  it("records acquisition and resets current round only", () => {
    const data = createDefaultData();
    const creatureId = data.creatures[0].id;
    const counted = incrementEncounter(incrementEncounter(data, creatureId), creatureId);

    const next = recordAcquisition(counted, creatureId, {
      date: "2026-05-22",
      location: "S2 活动区",
      notes: "测试记录",
    });

    expect(next.records).toHaveLength(1);
    expect(next.records[0]).toMatchObject({
      creatureId,
      roundEncounters: 2,
      totalEncountersAtRecord: 2,
      location: "S2 活动区",
      notes: "测试记录",
    });
    expect(next.creatures[0].currentEncounters).toBe(0);
    expect(next.creatures[0].totalEncounters).toBe(2);
  });

  it("does not decrement historical total after acquisition resets current round", () => {
    const data = createDefaultData();
    const creatureId = data.creatures[0].id;
    const counted = incrementEncounter(incrementEncounter(data, creatureId), creatureId);
    const recorded = recordAcquisition(counted, creatureId, {
      date: "2026-05-22",
      location: "",
      notes: "",
    });

    const next = decrementEncounter(recorded, creatureId);

    expect(next.creatures[0].currentEncounters).toBe(0);
    expect(next.creatures[0].totalEncounters).toBe(2);
  });

  it("adds, updates, and removes custom creatures", () => {
    const data = createDefaultData();
    const added = addCreature(data, {
      name: "自定义精灵",
      targetCount: 500,
      location: "自定义地点",
      notes: "自定义备注",
    });
    const custom = added.creatures[added.creatures.length - 1];

    expect(custom).toMatchObject({ name: "自定义精灵", isDefault: false });

    const updated = updateCreature(added, custom.id, {
      name: "更新精灵",
      targetCount: 600,
      location: "更新地点",
      notes: "更新备注",
    });

    expect(updated.creatures[updated.creatures.length - 1]).toMatchObject({
      name: "更新精灵",
      targetCount: 600,
    });

    const removed = removeCreature(updated, custom.id);
    expect(removed.creatures.some((creature) => creature.id === custom.id)).toBe(false);
  });

  it("calculates aggregate stats", () => {
    const data = createDefaultData();
    const creatureId = data.creatures[0].id;
    const counted = incrementEncounter(incrementEncounter(data, creatureId), creatureId);
    const recorded = recordAcquisition(counted, creatureId, {
      date: "2026-05-22",
      location: "",
      notes: "",
    });

    expect(calculateStats(recorded)).toEqual({
      creatureCount: recorded.creatures.length,
      currentRoundTotal: 0,
      historicalTotal: 2,
      recordCount: 1,
    });
  });
});
