import type { AcquisitionRecord, AppData, Creature } from "./types";

export type ImportResult = { ok: true; data: AppData } | { ok: false; error: string };

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isCreature(value: unknown): value is Creature {
  if (!value || typeof value !== "object") return false;
  const creature = value as Record<string, unknown>;
  return (
    typeof creature.id === "string" &&
    creature.id.length > 0 &&
    typeof creature.name === "string" &&
    typeof creature.targetCount === "number" &&
    Number.isSafeInteger(creature.targetCount) &&
    creature.targetCount >= 1 &&
    isNonNegativeSafeInteger(creature.currentEncounters) &&
    isNonNegativeSafeInteger(creature.totalEncounters) &&
    creature.currentEncounters <= creature.totalEncounters &&
    typeof creature.location === "string" &&
    typeof creature.notes === "string" &&
    typeof creature.isDefault === "boolean"
  );
}

function isAcquisitionRecord(value: unknown): value is AcquisitionRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    record.id.length > 0 &&
    typeof record.creatureId === "string" &&
    typeof record.creatureName === "string" &&
    typeof record.date === "string" &&
    isNonNegativeSafeInteger(record.roundEncounters) &&
    isNonNegativeSafeInteger(record.totalEncountersAtRecord) &&
    typeof record.location === "string" &&
    typeof record.notes === "string"
  );
}

function hasUniqueIds(items: Array<{ id: string }>): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

export function isAppData(value: unknown): value is AppData {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  const settings = data.settings as Record<string, unknown> | undefined;
  if (!(
    data.version === 1 &&
    Array.isArray(data.creatures) &&
    data.creatures.every(isCreature) &&
    Array.isArray(data.records) &&
    data.records.every(isAcquisitionRecord) &&
    Boolean(settings) &&
    typeof settings === "object" &&
    settings.sortMode === "default"
  )) {
    return false;
  }

  const creatures = data.creatures;
  const records = data.records;
  const creatureIds = new Set(creatures.map((creature) => creature.id));
  return (
    hasUniqueIds(creatures) &&
    hasUniqueIds(records) &&
    records.every((record) => creatureIds.has(record.creatureId))
  );
}

export function parseImportedData(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "导入文件不是有效的 JSON。" };
  }

  if (!isAppData(parsed)) {
    return { ok: false, error: "导入数据结构不完整。" };
  }

  return { ok: true, data: parsed };
}

export function exportAppData(data: AppData): string {
  return JSON.stringify(data, null, 2);
}
