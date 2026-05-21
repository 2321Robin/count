import type { AcquisitionRecord, AppData, Creature } from "./types";

export type ImportResult = { ok: true; data: AppData } | { ok: false; error: string };

function isCreature(value: unknown): value is Creature {
  if (!value || typeof value !== "object") return false;
  const creature = value as Record<string, unknown>;
  return (
    typeof creature.id === "string" &&
    typeof creature.name === "string" &&
    typeof creature.targetCount === "number" &&
    typeof creature.currentEncounters === "number" &&
    typeof creature.totalEncounters === "number" &&
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
    typeof record.creatureId === "string" &&
    typeof record.creatureName === "string" &&
    typeof record.date === "string" &&
    typeof record.roundEncounters === "number" &&
    typeof record.totalEncountersAtRecord === "number" &&
    typeof record.location === "string" &&
    typeof record.notes === "string"
  );
}

export function isAppData(value: unknown): value is AppData {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  const settings = data.settings as Record<string, unknown> | undefined;
  return (
    data.version === 1 &&
    Array.isArray(data.creatures) &&
    data.creatures.every(isCreature) &&
    Array.isArray(data.records) &&
    data.records.every(isAcquisitionRecord) &&
    Boolean(settings) &&
    typeof settings === "object" &&
    settings.sortMode === "default"
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
