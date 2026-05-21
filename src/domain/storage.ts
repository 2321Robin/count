import { createDefaultData } from "./defaultData";
import { isAppData } from "./importExport";
import type { AcquisitionRecord, AppData, Creature } from "./types";

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
    records: migrateRecords(data.records),
  };
}

function migrateRecords(records: AcquisitionRecord[]): AcquisitionRecord[] {
  const countsByCreature = new Map<string, number>();

  return records
    .slice()
    .reverse()
    .map((record) => {
      const acquisitionNumber = record.acquisitionNumber ?? (countsByCreature.get(record.creatureId) ?? 0) + 1;
      countsByCreature.set(record.creatureId, acquisitionNumber);
      return { ...record, acquisitionNumber };
    })
    .reverse();
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
