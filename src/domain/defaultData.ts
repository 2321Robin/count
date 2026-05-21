import type { AppData, Creature } from "./types";

const defaultCreatures: Array<Pick<Creature, "id" | "name" | "targetCount" | "location" | "notes">> = [
  { id: "s2-creature-1", name: "S2 精灵 1", targetCount: 500, location: "S2 区域", notes: "等待替换为正式名称" },
  { id: "s2-creature-2", name: "S2 精灵 2", targetCount: 500, location: "S2 区域", notes: "等待替换为正式名称" },
  { id: "s2-creature-3", name: "S2 精灵 3", targetCount: 500, location: "S2 区域", notes: "等待替换为正式名称" },
];

export function createDefaultData(): AppData {
  return {
    version: 1,
    creatures: defaultCreatures.map((creature) => ({
      ...creature,
      currentEncounters: 0,
      totalEncounters: 0,
      isDefault: true,
    })),
    records: [],
    settings: { sortMode: "default" },
  };
}
