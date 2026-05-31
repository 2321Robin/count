import { createDefaultData } from "./defaultData";
import { formatDateTimeInput, normalizeRecordDate } from "./dateTime";
import type {
  AcquisitionRecord,
  AppData,
  Creature,
  CurrentRound,
  GiftedCaptureRecord,
  RoundEncounterSnapshot,
} from "./types";

type RawRecord = Omit<AcquisitionRecord, "acquisitionNumber" | "roundBreakdown"> & {
  acquisitionNumber?: number;
  roundBreakdown?: RoundEncounterSnapshot[];
};

type RawV1AppData = {
  version: 1;
  creatures: Creature[];
  records: RawRecord[];
  settings: AppData["settings"];
};

type RawV2AppData = Omit<AppData, "records" | "giftedRecords"> & {
  records: RawRecord[];
  giftedRecords: GiftedCaptureRecord[];
};

type RawAppData = RawV1AppData | RawV2AppData;

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

export function isRecordDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?$/.test(value);
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

function isRoundBreakdown(value: unknown): value is RoundEncounterSnapshot[] {
  return Array.isArray(value) && value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const snapshot = item as Record<string, unknown>;
    return (
      typeof snapshot.creatureId === "string" &&
      snapshot.creatureId.length > 0 &&
      typeof snapshot.creatureName === "string" &&
      isNonNegativeSafeInteger(snapshot.encounters)
    );
  });
}

function isAcquisitionRecord(value: unknown): value is RawRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    record.id.length > 0 &&
    typeof record.creatureId === "string" &&
    typeof record.creatureName === "string" &&
    isRecordDate(record.date) &&
    (record.acquisitionNumber === undefined || isNonNegativeSafeInteger(record.acquisitionNumber)) &&
    isNonNegativeSafeInteger(record.roundEncounters) &&
    (record.roundBreakdown === undefined || isRoundBreakdown(record.roundBreakdown)) &&
    isNonNegativeSafeInteger(record.totalEncountersAtRecord) &&
    typeof record.location === "string" &&
    typeof record.notes === "string"
  );
}

function isGiftedCaptureRecord(value: unknown): value is GiftedCaptureRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    record.id.length > 0 &&
    typeof record.creatureId === "string" &&
    typeof record.creatureName === "string" &&
    isRecordDate(record.receivedAt) &&
    typeof record.giftedBy === "string" &&
    typeof record.notes === "string"
  );
}

function isCurrentRound(value: unknown): value is CurrentRound | null {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const round = value as Record<string, unknown>;
  return Array.isArray(round.creatureIds) && round.creatureIds.every((id) => typeof id === "string") && isRecordDate(round.updatedAt);
}

function hasUniqueIds(items: Array<{ id: string }>): boolean {
  return new Set(items.map((item) => item.id)).size === items.length;
}

function hasUniqueStrings(items: string[]): boolean {
  return new Set(items).size === items.length;
}

function isRawAppData(value: unknown): value is RawAppData {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  const settings = data.settings as Record<string, unknown> | undefined;
  if (!(
    (data.version === 1 || data.version === 2) &&
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

  if (data.version === 2 && !(
    Array.isArray(data.giftedRecords) &&
    data.giftedRecords.every(isGiftedCaptureRecord) &&
    isCurrentRound(data.currentRound)
  )) {
    return false;
  }

  const creatures = data.creatures;
  const records = data.records;
  const creatureIds = new Set(creatures.map((creature) => creature.id));
  const round = data.currentRound as CurrentRound | null | undefined;
  const giftedRecords = data.version === 2 ? data.giftedRecords as GiftedCaptureRecord[] : [];

  return (
    hasUniqueIds(creatures) &&
    hasUniqueIds(records) &&
    hasUniqueIds(giftedRecords) &&
    records.every((record) => creatureIds.has(record.creatureId)) &&
    records.every((record) => record.roundBreakdown === undefined || record.roundBreakdown.every((item) => creatureIds.has(item.creatureId))) &&
    giftedRecords.every((record) => creatureIds.has(record.creatureId)) &&
    (round === undefined || round === null || (hasUniqueStrings(round.creatureIds) && round.creatureIds.every((id) => creatureIds.has(id))))
  );
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

function migrateRecords(records: RawRecord[]): AcquisitionRecord[] {
  const countsByCreature = new Map<string, number>();

  return records
    .slice()
    .reverse()
    .map((record) => {
      const acquisitionNumber = record.acquisitionNumber ?? (countsByCreature.get(record.creatureId) ?? 0) + 1;
      countsByCreature.set(record.creatureId, acquisitionNumber);
      return {
        ...record,
        date: normalizeRecordDate(record.date),
        acquisitionNumber,
        roundBreakdown: record.roundBreakdown ?? [{
          creatureId: record.creatureId,
          creatureName: record.creatureName,
          encounters: record.roundEncounters,
        }],
      };
    })
    .reverse();
}

function migrateGiftedRecords(records: GiftedCaptureRecord[]): GiftedCaptureRecord[] {
  return records.map((record) => ({ ...record, receivedAt: normalizeRecordDate(record.receivedAt) }));
}

function migrateCurrentRound(data: RawAppData, creatures: Creature[]): CurrentRound | null {
  if (data.version === 2) {
    const ids = data.currentRound?.creatureIds ?? [];
    return ids.length === 0 ? null : { creatureIds: ids, updatedAt: normalizeRecordDate(data.currentRound!.updatedAt) };
  }

  const creatureIds = creatures.filter((creature) => creature.currentEncounters > 0).map((creature) => creature.id);
  return creatureIds.length === 0 ? null : { creatureIds, updatedAt: formatDateTimeInput() };
}

export function migrateAppData(value: unknown): AppData | null {
  if (!isRawAppData(value)) return null;

  const defaultById = new Map(createDefaultData().creatures.map((creature) => [creature.id, creature]));
  const creatures = value.creatures.map((creature) => migrateCreature(creature, defaultById));
  const migrated: AppData = {
    version: 2,
    creatures,
    records: migrateRecords(value.records),
    giftedRecords: value.version === 2 ? migrateGiftedRecords(value.giftedRecords) : [],
    currentRound: migrateCurrentRound(value, creatures),
    settings: value.settings,
  };

  return migrated;
}

export function isAppData(value: unknown): value is AppData {
  return migrateAppData(value) !== null;
}
