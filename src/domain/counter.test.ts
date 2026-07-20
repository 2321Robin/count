// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createDefaultData } from "./defaultData";
import { getSeasonConfig } from "./seasons";
import {
  addCreature,
  calculateStats,
  decrementEncounter,
  getCurrentRoundTotal,
  incrementEncounter,
  recordAcquisition,
  recordFairyTaleBook,
  recordGiftedCapture,
  removeCreature,
  setCurrentRoundTarget,
  setCurrentRoundTargets,
  startNewRound,
  updateCreature,
} from "./counter";

describe("counter domain", () => {
  it("creates S2 default data from the existing creature list", () => {
    const data = createDefaultData("s2");
    const defaultNames = data.creatures.map((creature) => creature.name);

    expect(data.version).toBe(4);
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
    expect(data.creatures.every((creature) => creature.currentEncounters === 0 && creature.totalEncounters === 0 && creature.isDefault)).toBe(true);
    expect(data.records).toEqual([]);
    expect(data.giftedRecords).toEqual([]);
    expect(data.currentRound).toBeNull();
  });

  it("shows S3 as selectable with default creatures populated", () => {
    expect(getSeasonConfig("s3").isAvailable).toBe(true);
    expect(getSeasonConfig("s3").defaultCreatures.length).toBe(20);
  });

  it("increments current and total encounters and joins the active round", () => {
    const data = createDefaultData();
    const creatureId = data.creatures[0].id;

    const next = incrementEncounter(data, creatureId);

    expect(next.creatures[0].currentEncounters).toBe(1);
    expect(next.creatures[0].totalEncounters).toBe(1);
    expect(next.currentRound?.creatureIds).toEqual([creatureId]);
  });

  it("decrements counts without going below zero", () => {
    const data = createDefaultData();
    const creatureId = data.creatures[0].id;

    const next = decrementEncounter(data, creatureId);

    expect(next.creatures[0].currentEncounters).toBe(0);
    expect(next.creatures[0].totalEncounters).toBe(0);
  });

  it("records acquisition and removes zero-count current round targets", () => {
    const data = createDefaultData();
    const firstCreatureId = data.creatures[0].id;
    const secondCreatureId = data.creatures[1].id;
    const round = setCurrentRoundTargets(data, [firstCreatureId, secondCreatureId]);
    const counted = incrementEncounter(
      incrementEncounter(
        incrementEncounter(round, firstCreatureId),
        firstCreatureId,
      ),
      secondCreatureId,
    );

    const next = recordAcquisition(counted, firstCreatureId, {
      date: "2026-05-22",
      location: "S2 活动区",
      notes: "测试记录",
    });

    expect(next.records).toHaveLength(1);
    expect(next.records[0]).toMatchObject({
      creatureId: firstCreatureId,
      acquisitionNumber: 1,
      roundEncounters: 3,
      totalEncountersAtRecord: 2,
      location: "S2 活动区",
      notes: "测试记录",
    });
    expect(next.records[0].roundBreakdown).toEqual([
      { creatureId: firstCreatureId, creatureName: data.creatures[0].name, encounters: 2 },
      { creatureId: secondCreatureId, creatureName: data.creatures[1].name, encounters: 1 },
    ]);
    expect(next.records[0].date).toBe("2026-05-22T00:00:00");
    expect(next.creatures[0].currentEncounters).toBe(0);
    expect(next.creatures[1].currentEncounters).toBe(0);
    expect(next.creatures[0].totalEncounters).toBe(2);
    expect(next.creatures[1].totalEncounters).toBe(1);
    expect(next.currentRound?.creatureIds).toEqual([]);
  });

  it("keeps unrelated current round counts when recording outside active targets", () => {
    const data = createDefaultData();
    const firstCreatureId = data.creatures[0].id;
    const secondCreatureId = data.creatures[1].id;
    const firstCounted = incrementEncounter(data, firstCreatureId);
    const round = setCurrentRoundTargets(firstCounted, [secondCreatureId]);
    const counted = incrementEncounter(round, secondCreatureId);

    const next = recordAcquisition(counted, firstCreatureId, {
      date: "2026-05-22T08:09:10",
      location: "",
      notes: "",
    });

    expect(next.records[0].roundEncounters).toBe(1);
    expect(next.creatures[0].currentEncounters).toBe(0);
    expect(next.creatures[1].currentEncounters).toBe(1);
  });

  it("numbers acquisitions per creature", () => {
    const data = createDefaultData();
    const firstCreatureId = data.creatures[0].id;
    const secondCreatureId = data.creatures[1].id;
    const firstCounted = incrementEncounter(data, firstCreatureId);
    const firstRecorded = recordAcquisition(firstCounted, firstCreatureId, {
      date: "2026-05-22",
      location: "",
      notes: "",
    });
    const secondCounted = incrementEncounter(firstRecorded, secondCreatureId);
    const secondRecorded = recordAcquisition(secondCounted, secondCreatureId, {
      date: "2026-05-22",
      location: "",
      notes: "",
    });
    const firstAgainCounted = incrementEncounter(secondRecorded, firstCreatureId);

    const next = recordAcquisition(firstAgainCounted, firstCreatureId, {
      date: "2026-05-22",
      location: "",
      notes: "",
    });

    expect(next.records[0]).toMatchObject({ creatureId: firstCreatureId, acquisitionNumber: 2 });
    expect(next.records[1]).toMatchObject({ creatureId: secondCreatureId, acquisitionNumber: 1 });
    expect(next.records[2]).toMatchObject({ creatureId: firstCreatureId, acquisitionNumber: 1 });
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

  it("starts a new round by resetting current counters and removing zero-count targets", () => {
    const data = createDefaultData();
    const firstCreatureId = data.creatures[0].id;
    const secondCreatureId = data.creatures[1].id;
    const counted = incrementEncounter(incrementEncounter(data, firstCreatureId), secondCreatureId);

    const next = startNewRound(counted, [secondCreatureId]);

    expect(getCurrentRoundTotal(next)).toBe(0);
    expect(next.currentRound?.creatureIds).toEqual([]);
    expect(next.creatures[0].totalEncounters).toBe(1);
    expect(next.creatures[1].totalEncounters).toBe(1);
  });

  it("removes a creature from the current round when its count reaches zero", () => {
    const data = createDefaultData();
    const creatureId = data.creatures[0].id;
    const counted = incrementEncounter(data, creatureId);

    const next = decrementEncounter(counted, creatureId);

    expect(next.creatures[0].currentEncounters).toBe(0);
    expect(next.currentRound?.creatureIds ?? []).toEqual([]);
  });

  it("records off-target acquisitions without changing current round counts", () => {
    const data = createDefaultData();
    const targetId = data.creatures[0].id;
    const offTargetId = data.creatures[1].id;
    const targeted = setCurrentRoundTarget(data, targetId);
    const counted = incrementEncounter(incrementEncounter(targeted, targetId), targetId);

    const next = recordAcquisition(counted, offTargetId, {
      date: "2026-05-22T08:09:10",
      location: "",
      notes: "歪了",
      isOffTarget: true,
    });

    expect(next.records[0]).toMatchObject({
      creatureId: offTargetId,
      isOffTarget: true,
      targetCreatureId: targetId,
      targetCreatureName: data.creatures[0].name,
      targetRoundEncounters: 2,
      roundEncounters: 2,
      notes: "歪了",
    });
    expect(next.creatures[0].currentEncounters).toBe(2);
    expect(next.creatures[1].currentEncounters).toBe(0);
    expect(next.currentRound?.creatureIds).toEqual([targetId]);
  });

  it("keeps current round counts when the active target is manually marked off-target", () => {
    const data = createDefaultData();
    const targetId = data.creatures[0].id;
    const targeted = setCurrentRoundTarget(data, targetId);
    const counted = incrementEncounter(incrementEncounter(targeted, targetId), targetId);

    const next = recordAcquisition(counted, targetId, {
      date: "2026-05-22T08:09:10",
      location: "",
      notes: "歪了",
      isOffTarget: true,
    });

    expect(next.records[0]).toMatchObject({
      creatureId: targetId,
      isOffTarget: true,
      targetCreatureId: targetId,
      targetCreatureName: data.creatures[0].name,
      targetRoundEncounters: 2,
      roundEncounters: 2,
      notes: "歪了",
    });
    expect(next.creatures[0].currentEncounters).toBe(2);
    expect(next.currentRound?.creatureIds).toEqual([targetId]);
  });

  it("can record a different creature as not off-target and clear active counts", () => {
    const data = createDefaultData();
    const targetId = data.creatures[0].id;
    const acquiredId = data.creatures[1].id;
    const targeted = setCurrentRoundTarget(data, targetId);
    const counted = incrementEncounter(targeted, acquiredId);

    const next = recordAcquisition(counted, acquiredId, {
      date: "2026-05-22T08:09:10",
      location: "",
      notes: "",
      isOffTarget: false,
    });

    expect(next.records[0]).toMatchObject({ creatureId: acquiredId, isOffTarget: false, roundEncounters: 1 });
    expect(next.creatures[1].currentEncounters).toBe(0);
    expect(next.currentRound?.creatureIds).toEqual([]);
  });

  it("records gifted captures without changing own counters or own history", () => {
    const data = createDefaultData();
    const creatureId = data.creatures[0].id;
    const counted = incrementEncounter(data, creatureId);

    const next = recordGiftedCapture(counted, {
      creatureId,
      date: "2026-05-22T08:09:10",
      giftedBy: "朋友",
      notes: "送的",
    });

    expect(next.records).toHaveLength(0);
    expect(next.giftedRecords).toHaveLength(1);
    expect(next.giftedRecords[0]).toMatchObject({
      creatureId,
      creatureName: data.creatures[0].name,
      receivedAt: "2026-05-22T08:09:10",
      giftedBy: "朋友",
      notes: "送的",
    });
    expect(next.creatures[0].currentEncounters).toBe(1);
    expect(next.creatures[0].totalEncounters).toBe(1);
  });

  it("adds, updates, and removes custom creatures", () => {
    const data = createDefaultData();
    const added = addCreature(data, {
      name: "自定义精灵",
      targetCount: 80,
      location: "",
      notes: "",
    });
    const custom = added.creatures[added.creatures.length - 1];

    expect(custom).toMatchObject({ name: "自定义精灵", isDefault: false });

    const updated = updateCreature(added, custom.id, {
      name: "更新精灵",
      targetCount: 90,
      location: "",
      notes: "",
    });

    expect(updated.creatures[updated.creatures.length - 1]).toMatchObject({
      name: "更新精灵",
      targetCount: 90,
      location: "",
      notes: "",
    });

    const gifted = recordGiftedCapture(updated, { creatureId: custom.id, date: "2026-05-22", giftedBy: "", notes: "" });
    const removed = removeCreature(gifted, custom.id);
    expect(removed.creatures.some((creature) => creature.id === custom.id)).toBe(false);
    expect(removed.giftedRecords.some((record) => record.creatureId === custom.id)).toBe(false);
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
    const gifted = recordGiftedCapture(recorded, { creatureId, date: "2026-05-23", giftedBy: "", notes: "" });

    expect(calculateStats(gifted)).toEqual({
      creatureCount: gifted.creatures.length,
      currentRoundTotal: 0,
      historicalTotal: 2,
      recordCount: 1,
      giftedRecordCount: 1,
      fairyTaleBookRecordCount: 0,
    });
  });

  it("records a fairy tale book entry without modifying current round data", () => {
    const data = createDefaultData();
    const baomizai = data.creatures.find((c) => c.id === "s3-adventure-baomizai")!;
    const shouyezhu = data.creatures.find((c) => c.id === "s3-adventure-shouyezhu")!;
    const lishu = data.creatures.find((c) => c.id === "s3-adventure-lishu")!;

    const counted = incrementEncounter(incrementEncounter(data, baomizai.id), shouyezhu.id);
    const roundBefore = counted.currentRound;
    const currentBefore = counted.creatures.map((c) => ({ id: c.id, current: c.currentEncounters, total: c.totalEncounters }));

    const next = recordFairyTaleBook(counted, {
      date: "2026-07-20T12:00:00",
      entries: [
        { creatureId: baomizai.id, count: 3 },
        { creatureId: shouyezhu.id, count: 2 },
      ],
      shinyCreatureIds: [baomizai.id],
      notes: "第一本童话绘本",
    });

    expect(next.records).toHaveLength(0);
    expect(next.fairyTaleBookRecords).toHaveLength(1);
    expect(next.fairyTaleBookRecords[0]).toMatchObject({
      date: "2026-07-20T12:00:00",
      entries: [
        { creatureId: baomizai.id, creatureName: baomizai.name, count: 3 },
        { creatureId: shouyezhu.id, creatureName: shouyezhu.name, count: 2 },
      ],
      shinyCreatureIds: [baomizai.id],
      notes: "第一本童话绘本",
    });
    expect(next.fairyTaleBookRecords[0].id).toMatch(/^fairytale-/);
    expect(next.currentRound).toEqual(roundBefore);
    next.creatures.forEach((c) => {
      const before = currentBefore.find((b) => b.id === c.id)!;
      expect(c.currentEncounters).toBe(before.current);
      expect(c.totalEncounters).toBe(before.total);
    });
  });

  it("prepends new fairy tale book records to the list", () => {
    const data = createDefaultData();
    const baomizai = data.creatures.find((c) => c.id === "s3-adventure-baomizai")!;

    const first = recordFairyTaleBook(data, {
      date: "2026-07-20T12:00:00",
      entries: [{ creatureId: baomizai.id, count: 1 }],
      shinyCreatureIds: [baomizai.id],
      notes: "",
    });
    const second = recordFairyTaleBook(first, {
      date: "2026-07-21T12:00:00",
      entries: [{ creatureId: baomizai.id, count: 2 }],
      shinyCreatureIds: [baomizai.id],
      notes: "",
    });

    expect(second.fairyTaleBookRecords).toHaveLength(2);
    expect(second.fairyTaleBookRecords[0].date).toBe("2026-07-21T12:00:00");
    expect(second.fairyTaleBookRecords[1].date).toBe("2026-07-20T12:00:00");
  });

  it("includes fairy tale book record count in stats", () => {
    const data = createDefaultData();
    const baomizai = data.creatures.find((c) => c.id === "s3-adventure-baomizai")!;

    const recorded = recordFairyTaleBook(data, {
      date: "2026-07-20T12:00:00",
      entries: [{ creatureId: baomizai.id, count: 1 }],
      shinyCreatureIds: [baomizai.id],
      notes: "",
    });

    expect(calculateStats(recorded).fairyTaleBookRecordCount).toBe(1);
  });
});
