import { createDefaultData } from "./defaultData";
import { isAppData } from "./importExport";
import type { AppData, Creature } from "./types";

export const STORAGE_KEY = "s2-capture-counter:data";

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultData();

    const parsed: unknown = JSON.parse(raw);
    return isAppData(parsed) ? migrateAppData(parsed) : createDefaultData();
  } catch {
    return createDefaultData();
  }
}

export function saveAppData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function migrateAppData(data: AppData): AppData {
  const defaultById = new Map(createDefaultData().creatures.map((creature) => [creature.id, creature]));

  return {
    ...data,
    creatures: data.creatures.map((creature) => migrateCreature(creature, defaultById)),
  };
}

function migrateCreature(creature: Creature, defaultById: Map<string, Creature>): Creature {
  const defaultCreature = defaultById.get(creature.id);
  if (!creature.isDefault || !defaultCreature) return creature;

  return {
    ...creature,
    targetCount: defaultCreature.targetCount,
    location: defaultCreature.location,
    notes: defaultCreature.notes,
  };
}
